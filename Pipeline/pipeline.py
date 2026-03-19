"""
pipeline.py
===========
Pipeline de traitement de documents OCR stockés dans MongoDB.

Flux général :
  Pour chaque document dans `ocr_results` :
    1. Détection du type de document (FACTURE / RIB)
    2. Extraction et validation du SIRET via l'API Gouvernement
    3. Extraction des informations métier
    4. Insertion du résultat enrichi dans `corrections`
"""

import os
import re
import json
import logging
import requests
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import ObjectId

# ---------------------------------------------------------------------------
# Correction SSL/TLS (PostgreSQL CA bundle issue on Windows)
# ---------------------------------------------------------------------------

INVALID_POSTGRES_CA = r"C:\Program Files\PostgreSQL\16\ssl\certs\ca-bundle.crt"

for var in ["CURL_CA_BUNDLE", "REQUESTS_CA_BUNDLE"]:
    if os.environ.get(var) == INVALID_POSTGRES_CA:
        os.environ.pop(var, None)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MONGODB_URL = "mongodb+srv://uzumaki:7RB3esUw7DdZOKjG@cluster0.n3c15l7.mongodb.net/"
MONGODB_DB  = "ocr_database"
COL_SOURCE  = "ocr_results"
COL_DEST    = "corrections"

GOUV_API_URL = "https://recherche-entreprises.api.gouv.fr/search"

# Motif Regex pour l'extraction du SIRET (14 chiffres consécutifs)
SIRET_PATTERN = r"(?<!\d)(\d{14})(?!\d)"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ===========================================================================
# FONCTIONS UTILITAIRES
# ===========================================================================

def detect_document_type(text: str) -> str | None:
    """
    Règle 0 — Détection du type de document.

    Inspecte le contenu textuel OCR pour identifier si le document est
    une FACTURE ou un RIB. La recherche est insensible à la casse et tolère
    les caractères accentués courants produits par l'OCR.

    Retourne "FACTURE", "RIB" ou None si le type ne peut pas être déterminé.
    """
    text_upper = text.upper()

    # Chercher les mots-clés caractéristiques de chaque type
    if re.search(r"\bFACTURE\b", text_upper):
        return "FACTURE"
    if (
        re.search(r"\bRIB\b", text_upper)
        or re.search(r"RELEV[EÉ]\s+D['\s]IDENTIT[EÉ]\s+BANCAIRE", text_upper)
        or (re.search(r"\bIBAN\b", text_upper) and re.search(r"\bBIC\b", text_upper))
    ):
        return "RIB"

    return None


def extract_siret(text: str) -> str | None:
    """
    Règle A1 — Extraction du numéro SIRET depuis le texte OCR.

    Un SIRET est composé exactement de 14 chiffres consécutifs.
    On s'assure que la séquence n'est pas entourée d'autres chiffres
    pour éviter les faux positifs.

    Retourne la chaîne SIRET (14 chiffres) ou None si absent.
    """
    # Le SIRET peut être affiché avec des espaces (ex. : 123 456 789 01234)
    # On normalise d'abord en supprimant les espaces entre groupes de chiffres
    text_normalized = re.sub(r"(\d)\s+(\d)", r"\1\2", text)

    match = re.search(SIRET_PATTERN, text_normalized)
    if match:
        return match.group(1)
    return None


def call_gouv_api(query: str) -> dict:
    """
    Appel à l'API Gouvernement de recherche d'entreprises.

    Paramètre `query` : peut être un SIRET (14 chiffres) ou un texte
    libre (nom + adresse).

    Retourne un dictionnaire {
        "total_results": int,
        "results": [...]   # liste des entreprises trouvées
    } ou un dictionnaire vide en cas d'erreur réseau.
    """
    try:
        response = requests.get(
            GOUV_API_URL,
            params={"q": query},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        log.info("  [API Gouv] Requête OK — %d résultat(s) pour : %r",
                 data.get("total_results", 0), query[:60])
        return data
    except requests.RequestException as exc:
        log.error("  [API Gouv] Erreur réseau : %s", exc)
        return {}


def siret_confirmed_by_api(siret: str, api_data: dict) -> bool:
    """
    Vérifie qu'un SIRET précis est confirmé par les données retournées
    par l'API Gouvernement.

    Un SIRET est confirmé si l'API retourne au moins un résultat ET que
    le SIRET figure parmi les `matching_etablissements` ou que le SIREN
    (9 premiers chiffres) correspond à un résultat.
    """
    results = api_data.get("results", [])
    if not results:
        return False

    siren = siret[:9]

    for entreprise in results:
        # Vérification via le SIREN de l'entreprise
        if entreprise.get("siren") == siren:
            return True
        # Vérification via les établissements correspondants
        for etab in entreprise.get("matching_etablissements", []):
            if etab.get("siret") == siret:
                return True

    return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_get(pattern: str, text: str, group: int = 1) -> str | None:
    """
    Cherche `pattern` dans `text` et retourne le groupe capturant demandé,
    ou None si aucune correspondance n'est trouvée.
    """
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(group).strip() if m else None


def clean_query(q: str) -> str:
    """
    Nettoie une chaîne de recherche pour l'API Gouv.
    Supprime le bruit OCR courant et les termes internes non pertinents.
    """
    if not q: return ""
    
    # Liste de bruits OCR ou labels internes typiques à ignorer
    noise_patterns = [
        r"PHYSIQUE-OUTREMER",
        r"PARTIE RESERVEE.*",
        r"T[EÉ]L\s*[:\d\s\.]+",
        r"RELEVE D'IDENTITE BANCAIRE",
        r"IDENTIFIANT NATIONAL.*",
    ]
    
    cleaned = q
    for p in noise_patterns:
        cleaned = re.sub(p, " ", cleaned, flags=re.IGNORECASE)
    
    # Nettoyage des caractères spéciaux et espaces en trop
    cleaned = re.sub(r"[^\w\s\d]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    return cleaned


def format_gouv_info(api_data: dict) -> dict:
    """
    Synthétise la réponse brute de l'API Gouvernement en ne conservant
    que les champs utiles pour le document `corrections`.

    Champs conservés (premier résultat retourné) :
      - siren          : identifiant SIREN (9 chiffres)
      - siret_siege    : SIRET du siège social
      - nom_complet    : dénomination légale
      - adresse        : adresse du siège
      - activite_principale : code NAF + libellé
      - forme_juridique : libellé de la forme juridique
      - tranche_effectif : tranche d'effectif salarié
      - date_creation  : date de création de l'entreprise
    """
    results = api_data.get("results", [])
    if not results:
        return {}

    ent = results[0]  # On prend toujours le premier résultat

    # Adresse du siège (peut être dans `siege` ou dans les établissements)
    siege = ent.get("siege") or (ent.get("matching_etablissements") or [{}])[0]
    adresse_parts = [
        siege.get("numero_voie"),
        siege.get("type_voie"),
        siege.get("libelle_voie"),
        siege.get("code_postal"),
        siege.get("libelle_commune"),
    ]
    adresse_str = " ".join(p for p in adresse_parts if p) or None

    # Activité principale (code NAF + libellé)
    activite = ent.get("activite_principale") or ent.get("section_activite_principale")
    activite_label = ent.get("libelle_activite_principale")
    if activite and activite_label:
        activite_str = f"{activite} — {activite_label}"
    elif activite:
        activite_str = activite
    else:
        activite_str = None

    return {
        "siren":             ent.get("siren"),
        "siret_siege":       siege.get("siret"),
        "nom_complet":       ent.get("nom_complet") or ent.get("nom_razon_sociale"),
        "adresse":           adresse_str,
    }


# ---------------------------------------------------------------------------
# Extraction d'informations — FACTURE
# ---------------------------------------------------------------------------

def extract_facture_info(text: str, siret: str | None = None) -> dict:
    """
    Extrait les champs métier d'une FACTURE depuis le texte OCR.

    Champs retournés :
      - nom_fournisseur       : nom / raison sociale du fournisseur
      - siret_fournisseur     : SIRET du fournisseur (14 chiffres)
      - biens_et_produits     : liste [{NomProduit, Quantite, prix_unitaire_ht}]
      - total_ht              : montant hors taxes
      - tva                   : montant de la TVA
      - ttc                   : montant toutes taxes comprises
    """

    # --- ID Facture ---
    id_facture = _safe_get(r"Facture\s+([A-Z0-9\-]+)", text)

    # --- Nom fournisseur ---
    # Recherche spécifique "Entrepnse" (typo OCR) ou "Société" ou ligne après un block "Fournisseur"
    nom_fournisseur = _safe_get(r"Entrep[ns]e\s+(.+)", text)
    if not nom_fournisseur:
        # Si on ne trouve pas "Entrepnse", on cherche sous "Fournisseur" s'il y a un SIRET
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for i, line in enumerate(lines):
            if re.match(r"^Fournisseur", line, re.IGNORECASE) and i + 2 < len(lines):
                # Souvent : Fournisseur \n SIRET ... \n Nom
                if re.search(SIRET_PATTERN, lines[i+1]):
                    nom_fournisseur = lines[i+1] # Cas où le nom est sur la même ligne que SIRET (rare)
                    if "SIRET" in nom_fournisseur:
                        nom_fournisseur = lines[i+2]
                    break

    # Repli : label explicite
    if not nom_fournisseur:
        nom_fournisseur = _safe_get(
            r"(?:fournisseur|vendeur|soci[eé]t[eé]|raison\s+sociale)\s*[:\-]?\s*(.+)",
            text,
        )

    # --- SIRET fournisseur ---
    # Priorité : valeur déjà extraite en amont (paramètre siret)
    siret_fournisseur = siret if siret else extract_siret(text)

    # --- Extraction des produits ---
    # Format attendu dans le texte OCR : "Nom produit   QTÉ   prix€"
    products = []
    product_pattern = r"([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s\-]{1,50})\s+(\d+)\s+([\d,\.]+)\s*€"
    skip_keywords = {"produit", "quantit", "total", "prix", "designation", "libelle"}

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        m = re.search(r"^([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s\-\.‘]{1,50})\s+(\d+)\s+([\d\s,\.]+)", line)
        if not m:
            continue
        nom_p = m.group(1).strip()
        # Nettoyage du nom (certains OCR ajoutent des caractères parasites au début)
        nom_p = re.sub(r"^[‘'\s]+", "", nom_p)
        
        if any(kw in nom_p.lower() for kw in skip_keywords):
            continue
        try:
            # Nettoyage du prix (suppression des espaces internes)
            price_raw = m.group(3).replace(",", ".").replace(" ", "")
            products.append({
                "NomProduit":        nom_p,
                "Quantite":          int(m.group(2)),
                "prix_unitaire_ht":  float(price_raw),
            })
        except ValueError:
            continue

    # --- Montants financiers ---
    # Fonction locale pour extraire un montant proprement (gère les espaces entre chiffres)
    def _parse_amount(label_regex: str, t: str) -> str | None:
        match = re.search(label_regex, t, re.IGNORECASE)
        if match:
            raw = match.group(1)
            # Nettoyage : garder seulement chiffres, points, virgules et espaces
            cleaned = re.sub(r"[^\d,\.\s]", "", raw).strip()
            # Si on a un format "202 920 94" on essaie de deviner si le dernier groupe est les centimes
            # On remplace les espaces par rien, puis on traite virgule vs point
            norm = cleaned.replace(" ", "")
            if len(norm) > 2 and norm[-2:].isdigit() and not any(c in norm[-3:] for c in ".,"):
                 # Cas "24350513" -> "243505.13" si on pense que c'est du TTC/HT plausible
                 pass # Heuristique risquée, on garde le brut pour l'instant
            return cleaned
        return None

    # Regex plus flexibles pour les labels
    total_ht = _parse_amount(r"TOTAL\s+HT\s*[:\-.]?\s*([\d\s,\.]+)", text)
    tva      = _parse_amount(r"TVA\s+(?:\d{1,2}[%°]?)?\s*[:\-.]?\s*([\d\s,\.]+)", text)
    ttc      = _parse_amount(r"TOTAL\s+TTC\s*[:\-.]?\s*([\d\s,\.]+)", text)

    return {
        "id_facture":        id_facture,
        "nom_fournisseur":   nom_fournisseur,
        "siret_fournisseur": siret_fournisseur,
        "biens_et_produits": products,
        "total_ht":          total_ht,
        "tva":               tva,
        "ttc":               ttc,
    }


# ---------------------------------------------------------------------------
# Extraction d'informations — RIB
# ---------------------------------------------------------------------------

def extract_rib_info(text: str) -> dict:
    """
    Extrait les champs métier d'un RIB depuis le texte OCR.
    Supporte plusieurs formats grâce à des regex flexibles.

    Champs retournés :
      - nom_fournisseur : nom du titulaire du compte
      - iban            : IBAN complet (sans espaces)
      - bic             : code BIC / SWIFT
      - rib             : coordonnées bancaires RIB brutes (banque, guichet, compte, clé)
    """

    # --- 1. IBAN (Focus France) ---
    # Recherche flexible : FR + 2 chiffres + 23 chiffres (éventuellement séparés par des espaces)
    iban_match = re.search(r"FR(?:\s?\d){25}", text, re.IGNORECASE)
    iban = re.sub(r"\s+", "", iban_match.group(0)).upper() if iban_match else None

    # --- 2. BIC / SWIFT ---
    bic = None
    # Stratégie A : Recherche après le mot-clé BIC
    bic_context = re.search(r"(?:BIC|Bank Identifier Code)\s*[:\-]?\s*([A-Z0-9\s]{8,15})", text, re.IGNORECASE)
    if bic_context:
        context_end = bic_context.end()
        # On regarde la ligne courante ou la suivante pour le code
        after_context = text[context_end:].strip().split('\n')[0]
        # Recherche d'un bloc de 8 à 11 caractères alphanumériques (typique BIC)
        m_bic = re.search(r"([A-Z]{4}\s?[A-Z]{2}\s?[A-Z0-9]{2}(?:\s?[A-Z0-9]{3})?)", after_context, re.IGNORECASE)
        if m_bic:
            bic = re.sub(r"\s+", "", m_bic.group(1).upper())
    
    # Stratégie B : Recherche après l'IBAN (souvent sur la même ligne ou juste après)
    if not bic and iban_match:
        after_iban = text[iban_match.end():].strip().split('\n')[0]
        m_bic = re.search(r"([A-Z]{4}\s?[A-Z]{2}\s?[A-Z0-9]{2}(?:\s?[A-Z0-9]{3})?)", after_iban, re.IGNORECASE)
        if m_bic:
            bic = re.sub(r"\s+", "", m_bic.group(1).upper())

    # --- 3. RIB brut (Banque / Guichet / Compte / Clé) ---
    rib = {}
    # Stratégie A : Recherche d'une ligne de données groupées (5 5 11 2)
    rib_line_match = re.search(r"(\d{5})\s+(\d{5})\s+([A-Z0-9]{11})\s+(\d{2})", text, re.IGNORECASE)
    if rib_line_match:
        rib = {
            "code_banque":   rib_line_match.group(1),
            "code_guichet":  rib_line_match.group(2),
            "numero_compte": rib_line_match.group(3),
            "cle_rib":       rib_line_match.group(4),
        }
    else:
        # Stratégie B : Recherche via les labels individuels
        for label, key in [
            (r"(?:code\s+)?banque\s*[:\-]?\s*(\d{5})", "code_banque"),
            (r"(?:code\s+)?guichet\s*[:\-]?\s*(\d{5})", "code_guichet"),
            (r"(?:n[°o]?\s+)?compte\s*[:\-]?\s*([A-Z0-9]{11})", "numero_compte"),
            (r"cl[eé]\s+rib\s*[:\-]?\s*(\d{2})", "cle_rib"),
        ]:
            val = _safe_get(label, text)
            if val:
                rib[key] = val

    # --- 4. Nom fournisseur / Titulaire ---
    nom_fournisseur = None
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    
    # On filtre les lignes qui sont en fait l'IBAN ou le BIC
    clean_lines = []
    for l in lines:
        normalized = re.sub(r"\s+", "", l).upper()
        if iban and iban in normalized: continue
        if bic and bic in normalized: continue
        clean_lines.append(l)

    for i, line in enumerate(clean_lines):
        # Recherche des marqueurs de titulaire
        if re.search(r"(?:Titulaire du compte|Account Owner|B[eé]n[eé]ficiaire|Client)", line, re.IGNORECASE):
            m = re.search(r"(?:Titulaire du compte|Account Owner|B[eé]n[eé]ficiaire|Client)(?:\s*\(.*\))?\s*[:\-]?\s*(.+)", line, re.IGNORECASE)
            if m and len(m.group(1).strip()) > 3:
                nom_fournisseur = m.group(1).strip()
                break
            if i + 1 < len(clean_lines):
                next_line = clean_lines[i+1]
                if not re.search(r"(?:IBAN|BIC|SIRET|T[EÉ]L|ADRESSE|DOMICILIATION)", next_line, re.IGNORECASE):
                    nom_fournisseur = next_line
                    break

    if not nom_fournisseur:
        for line in clean_lines:
            if not re.match(r"^(?:RIB|RELEV[EÉ]|IBAN|BIC|BANQUE|IDENTITE|DOMICILIATION|TITULAIRE|IDENTIFIANT|APPEL)", line, re.IGNORECASE):
                if len(line) > 3:
                    nom_fournisseur = line
                    break

    # --- 5. Adresse (Heuristique) ---
    adresse = None
    for i, line in enumerate(clean_lines):
        if re.search(r"\d{5}\s+[A-Z]", line): # CP + Ville
            adresse_parts = []
            if i > 0 and len(clean_lines[i-1]) > 5 and not re.search(r"(?:TITULAIRE|COMPTE|RIB|IBAN|BIC|NOM)", clean_lines[i-1], re.IGNORECASE):
                adresse_parts.append(clean_lines[i-1])
            adresse_parts.append(line)
            adresse = " ".join(adresse_parts)
            break

    return {
        "nom_fournisseur": nom_fournisseur,
        "nom_titulaire":   nom_fournisseur, # Alias pour compatibilité
        "iban":            iban,
        "bic":             bic,
        "rib":             rib if rib else None,
        "adresse":         adresse,
    }


# ===========================================================================
# BRANCHE A — Traitement FACTURE
# ===========================================================================

def process_facture(text: str) -> tuple[dict, dict, bool, bool, str | None, str | None, str, str]:
    """
    Applique les règles A1 et A2 pour le traitement d'une FACTURE.

    Retourne un tuple :
      (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
       WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT)
    """
    FLAG_SIRET   = False
    NUM_SIRET    = None
    WARNING_FLAG = False
    WARNING_TEXT = None
    STATUT       = None
    STATUT_TEXT  = None
    extracted_info = {}
    gouv_info      = {}

    # --- Règle A1 : Extraction du SIRET ---
    log.info("  [A1] Recherche du SIRET dans le texte…")
    NUM_SIRET = extract_siret(text)

    if NUM_SIRET is None:
        # SIRET absent → erreur immédiate
        log.warning("  [A1] SIRET non trouvé dans le document.")
        WARNING_FLAG = True
        WARNING_TEXT = "SIRET absent du document"
        STATUT       = "ERREUR"
        STATUT_TEXT  = "SIRET non trouvé lors du scraping"
        return (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
                WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT)

    log.info("  [A1] SIRET extrait : %s", NUM_SIRET)

    # --- Règle A2 : Validation API Gouvernement ---
    log.info("  [A2] Validation du SIRET via l'API Gouvernement…")
    api_data = call_gouv_api(NUM_SIRET)

    if siret_confirmed_by_api(NUM_SIRET, api_data):
        FLAG_SIRET     = True
        gouv_info      = format_gouv_info(api_data)          # champs synthétisés
        extracted_info = extract_facture_info(text, siret=NUM_SIRET)
        STATUT         = "SUCCES"
        STATUT_TEXT    = "SIRET vérifié, données extraites"
        log.info("  [A2] SIRET confirmé par l'API Gouvernement.")
    else:
        FLAG_SIRET   = False
        WARNING_FLAG = True
        WARNING_TEXT = "SIRET non confirmé par l'API Gouv"
        STATUT       = "ERREUR"
        STATUT_TEXT  = "Échec validation API Gouv"
        log.warning("  [A2] SIRET non confirmé par l'API Gouvernement.")

    return (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
            WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT)


# ===========================================================================
# BRANCHE B — Traitement RIB
# ===========================================================================

def process_rib(text: str) -> tuple[dict, dict, bool, bool, str | None, str | None, str, str]:
    """
    Applique les règles B1 et B2 pour le traitement d'un RIB.

    Retourne un tuple :
      (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
       WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT)
    """
    FLAG_SIRET   = False
    NUM_SIRET    = None
    WARNING_FLAG = False
    WARNING_TEXT = None
    STATUT       = None
    STATUT_TEXT  = None
    gouv_info    = {}

    # --- Règle B1 : Extraction Nom + Adresse ---
    log.info("  [B1] Extraction du nom du titulaire et de l'adresse…")
    extracted_info = extract_rib_info(text)

    nom     = extracted_info.get("nom_titulaire") or extracted_info.get("nom_fournisseur") or ""
    adresse = extracted_info.get("adresse") or ""

    log.info("  [B1] Nom titulaire : %r | Adresse : %r", nom, adresse)

    # --- Règle B2 : Résolution SIRET via API Gouvernement ---
    log.info("  [B2] Résolution SIRET via l'API Gouvernement (nom + adresse)…")
    
    # 1. Tentative avec requête complète nettoyée
    primary_query = clean_query(f"{nom} {adresse}")
    api_data = call_gouv_api(primary_query)
    results = api_data.get("results", [])

    # 2. Si 0 résultat, tentative avec le nom uniquement
    if not results and nom:
        log.info("  [B2] Aucun résultat avec l'adresse. Tentative avec le nom uniquement…")
        api_data = call_gouv_api(clean_query(nom))
        results = api_data.get("results", [])

    # 3. Filtrage et sélection du meilleur candidat si résultats multiples
    best_candidate = None
    if len(results) == 1:
        best_candidate = results[0]
    elif len(results) > 1:
        log.info("  [B2] %d résultats trouvés. Recherche du meilleur candidat (Banque/Adresse)…", len(results))
        
        # Mots-clés indiquant un établissement bancaire
        bank_keywords = ["BANQUE", "CREDIT", "MUTUEL", "CAISSE", "SOCIETE GENERALE", "BNP", "AGRICOLE"]
        
        # On score les résultats
        scored_results = []
        for res in results:
            score = 0
            nom_res = res.get("nom_complet", "").upper()
            
            # Bonus : Correspondance de mots-clés bancaires
            if any(kw in nom_res for kw in bank_keywords):
                score += 10
            
            # Bonus : Proximité de l'adresse (on cherche si le CP est dans l'adresse du siège)
            cp_match = re.search(r"\d{5}", adresse)
            if cp_match:
                cp = cp_match.group(0)
                siege_addr = str(res.get("siege", {}).get("adresse", "")).upper()
                if cp in siege_addr:
                    score += 15
            
            scored_results.append((score, res))
        
        # Tri par score décroissant
        scored_results.sort(key=lambda x: x[0], reverse=True)
        if scored_results[0][0] > 0:
            best_candidate = scored_results[0][1]
            log.info("  [B2] Candidat retenu : %s (Score: %d)", best_candidate.get("nom_complet"), scored_results[0][0])

    if best_candidate:
        # Récupération du SIRET depuis le premier établissement correspondant
        etabs = best_candidate.get("matching_etablissements", [])
        if etabs:
            NUM_SIRET = etabs[0].get("siret")
        else:
            NUM_SIRET = best_candidate.get("siren")

        FLAG_SIRET  = True
        # On met à jour gouv_info avec le candidat retenu
        gouv_info   = format_gouv_info({"results": [best_candidate]})
        STATUT      = "SUCCES"
        STATUT_TEXT = f"SIRET résolu : {best_candidate.get('nom_complet')}"
        log.info("  [B2] SIRET résolu : %s", NUM_SIRET)

    else:
        # Aucun résultat ou ambiguïté persistante
        NUM_SIRET    = None
        FLAG_SIRET   = False
        WARNING_FLAG = True
        WARNING_TEXT = "SIRET non trouvé ou ambigu"
        STATUT       = "ACTION_MANUELLE"
        STATUT_TEXT  = "Intervention manuelle requise — RIB non résolu"
        log.warning("  [B2] Échec de la résolution automatique du SIRET.")

    return (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
            WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT)


# ===========================================================================
# BRANCHE C — Traitement LLM
# ===========================================================================

def extract_document_data_llm(text: str, api_key: str) -> dict:
    url = "https://api.mammouth.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Tu es un extracteur de données financières. "
                    "Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.\n"
                    "Si c'est une FACTURE, retourne :\n"
                    '{"type":"facture","extracted_info":{"id_facture":"","date_facture":"","nom_fournisseur":"","siret_fournisseur":"","biens_et_produits":[{"NomProduit":"","Quantite":0,"prix_unitaire_ht":0}],"total_ht":0,"tva":0,"ttc":0}}\n'
                    "Si c'est un RIB, retourne :\n"
                    '{"type":"rib","extracted_info":{"nom_fournisseur":"","nom_titulaire":"","iban":"","bic":"","adresse":""}}\n'
                    "Champs absents = null. IBAN sans espaces en majuscules. Montants en nombres décimaux."
                )
            },
            {
                "role": "user",
                "content": text
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()

        # Nettoyage si backticks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        return json.loads(content.strip())
    except Exception as e:
        log.error("  [LLM] Erreur lors de l'appel LLM : %s", e)
        return None

def process_document_llm(text: str, api_key: str) -> tuple[dict, dict, bool, bool, str | None, str | None, str, str]:
    """
    Applique le traitement LLM puis valide par Gouv API.
    """
    FLAG_SIRET   = False
    NUM_SIRET    = None
    WARNING_FLAG = False
    WARNING_TEXT = None
    STATUT       = None
    STATUT_TEXT  = None
    gouv_info    = {}
    
    log.info("  [LLM] Appel de l'API LLM...")
    llm_result = extract_document_data_llm(text, api_key)

    if not llm_result:
        return {}, {}, False, True, "Erreur API LLM", None, "ERREUR", "Impossible d'extraire via LLM"

    doc_type = llm_result.get("type", "").upper()
    extracted_info = llm_result.get("extracted_info", {})

    if doc_type == "FACTURE":
        log.info("  [LLM] Type détecté: FACTURE")
        NUM_SIRET = extracted_info.get("siret_fournisseur")
        if not NUM_SIRET:
            log.warning("  [LLM] SIRET non trouvé dans le document.")
            return extracted_info, {}, False, True, "SIRET absent du document", None, "ERREUR", "SIRET non trouvé lors du scraping"

        log.info("  [LLM] SIRET extrait : %s. Validation Gouv API...", NUM_SIRET)
        api_data = call_gouv_api(NUM_SIRET)

        if siret_confirmed_by_api(NUM_SIRET, api_data):
            FLAG_SIRET  = True
            gouv_info   = format_gouv_info(api_data)
            STATUT      = "SUCCES"
            STATUT_TEXT = "SIRET vérifié, données extraites"
            log.info("  [LLM] SIRET confirmé par l'API Gouvernement.")
        else:
            WARNING_FLAG = True
            WARNING_TEXT = "SIRET non confirmé par l'API Gouv"
            STATUT       = "ERREUR"
            STATUT_TEXT  = "Échec validation API Gouv"
            log.warning("  [LLM] SIRET non confirmé par l'API Gouvernement.")

        return extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG, WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT

    elif doc_type == "RIB":
        log.info("  [LLM] Type détecté: RIB")
        nom = extracted_info.get("nom_titulaire") or extracted_info.get("nom_fournisseur") or ""
        adresse = extracted_info.get("adresse") or ""

        log.info("  [LLM] Résolution SIRET via l'API Gouvernement (nom: %r, addresse: %r)...", nom, adresse)
        primary_query = clean_query(f"{nom} {adresse}")
        api_data = call_gouv_api(primary_query)
        results = api_data.get("results", [])

        if not results and nom:
            log.info("  [LLM] Aucun résultat avec l'adresse. Tentative avec le nom uniquement…")
            api_data = call_gouv_api(clean_query(nom))
            results = api_data.get("results", [])

        best_candidate = None
        if len(results) == 1:
            best_candidate = results[0]
        elif len(results) > 1:
            log.info("  [LLM] %d résultats trouvés. Recherche du meilleur candidat...", len(results))
            bank_keywords = ["BANQUE", "CREDIT", "MUTUEL", "CAISSE", "SOCIETE GENERALE", "BNP", "AGRICOLE"]
            scored_results = []
            for res in results:
                score = 0
                nom_res = res.get("nom_complet", "").upper()
                if any(kw in nom_res for kw in bank_keywords):
                    score += 10
                cp_match = re.search(r"\d{5}", adresse)
                if cp_match:
                    cp = cp_match.group(0)
                    siege_addr = str(res.get("siege", {}).get("adresse", "")).upper()
                    if cp in siege_addr:
                        score += 15
                scored_results.append((score, res))
            
            scored_results.sort(key=lambda x: x[0], reverse=True)
            if scored_results[0][0] > 0:
                best_candidate = scored_results[0][1]
                log.info("  [LLM] Candidat retenu : %s (Score: %d)", best_candidate.get("nom_complet"), scored_results[0][0])

        if best_candidate:
            etabs = best_candidate.get("matching_etablissements", [])
            NUM_SIRET = etabs[0].get("siret") if etabs else best_candidate.get("siren")
            FLAG_SIRET  = True
            gouv_info   = format_gouv_info({"results": [best_candidate]})
            STATUT      = "SUCCES"
            STATUT_TEXT = f"SIRET résolu : {best_candidate.get('nom_complet')}"
            log.info("  [LLM] SIRET résolu : %s", NUM_SIRET)
        else:
            NUM_SIRET    = None
            FLAG_SIRET   = False
            WARNING_FLAG = True
            WARNING_TEXT = "SIRET non trouvé ou ambigu"
            STATUT       = "ACTION_MANUELLE"
            STATUT_TEXT  = "Intervention manuelle requise — RIB non résolu"
            log.warning("  [LLM] Échec de la résolution automatique du SIRET.")

        return extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG, WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT

    # Unknown type returned by LLM
    log.warning("  [LLM] Type inconnu: %s. Ignoré.", doc_type)
    return {}, {}, False, True, "Type de document LLM inconnu", None, "ERREUR", f"Type inconnu: {doc_type}"


# ===========================================================================
# INSERTION dans `corrections`
# ===========================================================================

def insert_correction(
    col_dest,
    source_doc: dict,
    document_id: str | None,
    type_doc: str,
    extracted_info: dict,
    gouv_info: dict,
    FLAG_SIRET: bool,
    WARNING_FLAG: bool,
    WARNING_TEXT: str | None,
    NUM_SIRET: str | None,
    STATUT: str,
    STATUT_TEXT: str,
) -> None:
    """
    Règle Finale — Insertion dans la collection `corrections`.

    Effectue les contrôles pré-insertion (BLOQUANT) puis insère le
    document enrichi. En cas d'erreur système (STATUT ou type_doc nuls),
    lève une SystemError.
    """

    # --- Contrôle pré-insertion (BLOQUANT) ---
    if STATUT is None:
        raise SystemError(
            "ERREUR SYSTÈME : STATUT non défini — insertion bloquée"
        )
    if type_doc is None:
        raise SystemError(
            "ERREUR SYSTÈME : type_doc non défini — insertion bloquée"
        )

    document = {
        "_id":            document_id,          # La clef primaire est document_id
        "document_id":    document_id,          # On garde aussi la colonne document_id
        "filename":       source_doc.get("filename"),
        "document_type":  type_doc,
        "siret":          NUM_SIRET,
        "extracted_info": extracted_info,
        "gouv_info":      gouv_info,
        "timestamp":      source_doc.get("timestamp"),
        "content_type":   source_doc.get("content_type"),
        "FLAG_SIRET":     FLAG_SIRET,
        "WARNING_FLAG":   WARNING_FLAG,
        "WARNING_TEXT":   WARNING_TEXT,
        "STATUT":         STATUT,
        "STATUT_TEXT":    STATUT_TEXT,
        "processed_at":   datetime.now(timezone.utc),
    }

    col_dest.replace_one({"_id": document_id}, document, upsert=True)
    log.info("  [INSERT] Document inséré dans 'corrections' — STATUT=%s | _id=%s | document_id=%s",
             STATUT, document["_id"], document_id)


# ===========================================================================
# PIPELINE PRINCIPAL
# ===========================================================================

def run_pipeline(strategy: str = "regex", api_key: str = None) -> dict:
    """
    Point d'entrée du pipeline.
    Stratégies : "regex" ou "llm"
    ...
    Retourne un résumé de l'exécution.
    """
    log.info("=" * 60)
    log.info("Démarrage du pipeline OCR")
    log.info("=" * 60)

    # --- Connexion MongoDB ---
    log.info("Connexion à MongoDB…")
    try:
        client = MongoClient(MONGODB_URL)
        db     = client[MONGODB_DB]
        col_source = db[COL_SOURCE]
        col_dest   = db[COL_DEST]
    except Exception as e:
        log.error("Erreur de connexion MongoDB : %s", e)
        return {"status": "error", "message": str(e)}

    log.info("Connecté à la base '%s'.", MONGODB_DB)

    # --- Récupération des documents non traités ---
    log.info("Recherche des documents non traités…")
    # On cherche les documents qui n'ont pas le champ 'status' ou dont la valeur n'est pas 'processed'
    query = {"status": {"$ne": "processed"}}
    documents = list(col_source.find(query))
    total = len(documents)
    log.info("%d document(s) non traité(s) trouvé(s) dans '%s'.", total, COL_SOURCE)

    success_count  = 0
    error_count    = 0
    skipped_count  = 0
    details        = []

    for index, doc in enumerate(documents, start=1):
        # On récupère l'identifiant source (priorité à document_id)
        raw_id = doc.get("document_id") or doc.get("_id")
        
        # Conversion en ObjectId pour le stockage dans 'corrections'
        if isinstance(raw_id, str):
            try:
                document_id = ObjectId(raw_id)
            except:
                document_id = raw_id
        else:
            document_id = raw_id

        filename    = doc.get("filename", "<inconnu>")
        text        = doc.get("extracted_text") or doc.get("text") or ""

        log.info("-" * 60)
        log.info("[%d/%d] Traitement : %s", index, total, filename)

        try:
            if strategy == "llm":
                if not api_key:
                    log.error("  [ERREUR] api_key est requis pour la stratégie LLM")
                    error_count += 1
                    details.append({"id": document_id, "file": filename, "status": "ERROR", "error": "api_key manquante"})
                    continue
                
                type_doc = detect_document_type(text)
                if not type_doc:
                    log.warning("  [LLM] Type de document inconnu avant appel API. Ignoré.")
                    skipped_count += 1
                    details.append({"id": document_id, "file": filename, "status": "SKIPPED", "type": "UNKNOWN"})
                    continue
                
                if type_doc == "FACTURE":
                    if not extract_siret(text):
                        log.warning("  [LLM] Facture détectée mais aucun SIRET trouvé. Appel ignoré.")
                        skipped_count += 1
                        details.append({"id": document_id, "file": filename, "status": "SKIPPED", "type": "FACTURE_NO_SIRET"})
                        continue

                (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
                 WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT) = process_document_llm(text, api_key)
            else:
                type_doc = detect_document_type(text)
                if type_doc == "FACTURE":
                    (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
                     WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT) = process_facture(text)
                elif type_doc == "RIB":
                    (extracted_info, gouv_info, FLAG_SIRET, WARNING_FLAG,
                     WARNING_TEXT, NUM_SIRET, STATUT, STATUT_TEXT) = process_rib(text)
                else:
                    log.warning("  Type inconnu. Ignoré.")
                    skipped_count += 1
                    details.append({"id": document_id, "file": filename, "status": "SKIPPED", "type": type_doc})
                    continue

            insert_correction(
                col_dest=col_dest, source_doc=doc, document_id=document_id,
                type_doc=type_doc, extracted_info=extracted_info, gouv_info=gouv_info,
                FLAG_SIRET=FLAG_SIRET, WARNING_FLAG=WARNING_FLAG, WARNING_TEXT=WARNING_TEXT,
                NUM_SIRET=NUM_SIRET, STATUT=STATUT, STATUT_TEXT=STATUT_TEXT,
            )

            # Marquer le document comme traité dans la source
            col_source.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": "processed"}}
            )

            if STATUT == "SUCCES":
                success_count += 1
            else:
                error_count += 1
            
            details.append({"id": document_id, "file": filename, "status": STATUT, "type": type_doc})

        except Exception as exc:
            log.error("  [ERREUR] %s", exc)
            error_count += 1
            details.append({"id": document_id, "file": filename, "status": "ERROR", "error": str(exc)})

    # --- Résumé final ---
    summary = {
        "status":        "completed",
        "total":         total,
        "success":       success_count,
        "errors":        error_count,
        "skipped":       skipped_count,
        "details":       details,
        "timestamp":     datetime.now(timezone.utc).isoformat()
    }
    
    log.info("=" * 60)
    log.info("Pipeline terminé. Succès: %d | Erreurs: %d", success_count, error_count)
    log.info("=" * 60)

    client.close()
    return summary


# ===========================================================================
# POINT D'ENTRÉE
# ===========================================================================

if __name__ == "__main__":
    run_pipeline()
