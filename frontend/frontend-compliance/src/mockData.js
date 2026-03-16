export const mockAnomalies = [
  {
    id: "ANO-001",
    fournisseurId: "f1",
    fournisseurNom: "ACME Fournitures",
    type: "siret_mismatch",
    severite: "critique",
    titre: "SIRET incohérent entre documents",
    description:
      "Le SIRET 12345678901234 sur la facture FA-2024-089 diffère du SIRET 12345678909999 sur le bon de commande BC-2024-045.",
    documents: ["FA-2024-089", "BC-2024-045"],
    dateDetection: "2025-03-14T09:22:00Z",
  },
  {
    id: "ANO-002",
    fournisseurId: "f1",
    fournisseurNom: "ACME Fournitures",
    type: "tva_incoherence",
    severite: "critique",
    titre: "Taux de TVA incohérent",
    description:
      "La facture FA-2024-089 applique un taux TVA de 10 % alors que le contrat prévoit 20 %.",
    documents: ["FA-2024-089", "CONTRAT-2023-01"],
    dateDetection: "2025-03-14T09:22:00Z",
  },
  {
    id: "ANO-003",
    fournisseurId: "f1",
    fournisseurNom: "ACME Fournitures",
    type: "montant_calcul",
    severite: "warn",
    titre: "Écart de calcul HT × taux ≠ TTC",
    description:
      "Montant HT 1 200 € × 1,20 = 1 440 € attendu, mais TTC déclaré 1 435 € sur FA-2024-102.",
    documents: ["FA-2024-102"],
    dateDetection: "2025-03-13T14:05:00Z",
  },
  {
    id: "ANO-004",
    fournisseurId: "f2",
    fournisseurNom: "BTP Solutions",
    type: "urssaf_expire",
    severite: "critique",
    titre: "Attestation URSSAF expirée",
    description:
      "L'attestation de vigilance URSSAF a expiré le 28/02/2025. Aucun renouvellement transmis.",
    documents: ["ATT-URSSAF-2024-BTP"],
    dateDetection: "2025-03-15T08:00:00Z",
  },
  {
    id: "ANO-005",
    fournisseurId: "f3",
    fournisseurNom: "LogiTrans Express",
    type: "urssaf_expire_soon",
    severite: "warn",
    titre: "Attestation URSSAF expire bientôt",
    description:
      "L'attestation de vigilance URSSAF expire le 31/03/2025, soit dans 16 jours. Renouvellement recommandé.",
    documents: ["ATT-URSSAF-2025-LTE"],
    dateDetection: "2025-03-15T08:00:00Z",
  },
  {
    id: "ANO-006",
    fournisseurId: "f4",
    fournisseurNom: "Nettoyage Pro",
    type: "montant_calcul",
    severite: "warn",
    titre: "Écart de calcul HT × taux ≠ TTC",
    description:
      "Montant HT 850 € × 1,20 = 1 020 € attendu, mais TTC déclaré 1 018 € sur FA-2025-011.",
    documents: ["FA-2025-011"],
    dateDetection: "2025-03-12T11:30:00Z",
  },
];

export const mockFournisseurs = [
  { id: "f1", nom: "ACME Fournitures",      siret: "12345678901234", statut: "non_conforme",  nbCritiques: 2, nbWarnings: 1, nbDocuments: 5, derniereAnalyse: "2025-03-14T09:22:00Z" },
  { id: "f2", nom: "BTP Solutions",          siret: "98765432100010", statut: "non_conforme",  nbCritiques: 1, nbWarnings: 0, nbDocuments: 3, derniereAnalyse: "2025-03-15T08:00:00Z" },
  { id: "f3", nom: "LogiTrans Express",      siret: "55544433300021", statut: "avertissement", nbCritiques: 0, nbWarnings: 1, nbDocuments: 4, derniereAnalyse: "2025-03-15T08:00:00Z" },
  { id: "f4", nom: "Nettoyage Pro",          siret: "11122233344455", statut: "avertissement", nbCritiques: 0, nbWarnings: 1, nbDocuments: 2, derniereAnalyse: "2025-03-12T11:30:00Z" },
  { id: "f5", nom: "Imprimerie Dupont",      siret: "66677788899900", statut: "conforme",      nbCritiques: 0, nbWarnings: 0, nbDocuments: 3, derniereAnalyse: "2025-03-10T16:00:00Z" },
  { id: "f6", nom: "Services IT Lemaire",    siret: "33344455566677", statut: "conforme",      nbCritiques: 0, nbWarnings: 0, nbDocuments: 6, derniereAnalyse: "2025-03-11T10:15:00Z" },
];

export const mockDocuments = [
  { id: "FA-2024-089",        fournisseurId: "f1", fournisseur: "ACME Fournitures",   type: "Facture",            statut: "anomalie",      dateTraitement: "2025-03-14T09:20:00Z", anomalies: 2 },
  { id: "FA-2024-102",        fournisseurId: "f1", fournisseur: "ACME Fournitures",   type: "Facture",            statut: "avertissement", dateTraitement: "2025-03-13T14:00:00Z", anomalies: 1 },
  { id: "BC-2024-045",        fournisseurId: "f1", fournisseur: "ACME Fournitures",   type: "Bon de commande",    statut: "anomalie",      dateTraitement: "2025-03-14T09:20:00Z", anomalies: 1 },
  { id: "CONTRAT-2023-01",    fournisseurId: "f1", fournisseur: "ACME Fournitures",   type: "Contrat",            statut: "ok",            dateTraitement: "2025-03-01T10:00:00Z", anomalies: 0 },
  { id: "FA-2025-BTP-01",     fournisseurId: "f2", fournisseur: "BTP Solutions",      type: "Facture",            statut: "ok",            dateTraitement: "2025-03-10T09:00:00Z", anomalies: 0 },
  { id: "ATT-URSSAF-2024-BTP",fournisseurId: "f2", fournisseur: "BTP Solutions",      type: "Attestation URSSAF", statut: "anomalie",      dateTraitement: "2025-03-15T08:00:00Z", anomalies: 1 },
  { id: "BC-2025-BTP-03",     fournisseurId: "f2", fournisseur: "BTP Solutions",      type: "Bon de commande",    statut: "ok",            dateTraitement: "2025-03-08T11:00:00Z", anomalies: 0 },
  { id: "ATT-URSSAF-2025-LTE",fournisseurId: "f3", fournisseur: "LogiTrans Express",  type: "Attestation URSSAF", statut: "avertissement", dateTraitement: "2025-03-15T08:00:00Z", anomalies: 1 },
  { id: "FA-2025-LTE-01",     fournisseurId: "f3", fournisseur: "LogiTrans Express",  type: "Facture",            statut: "ok",            dateTraitement: "2025-03-09T14:00:00Z", anomalies: 0 },
  { id: "FA-2025-011",        fournisseurId: "f4", fournisseur: "Nettoyage Pro",      type: "Facture",            statut: "avertissement", dateTraitement: "2025-03-12T11:30:00Z", anomalies: 1 },
  { id: "ATT-URSSAF-2025-NP", fournisseurId: "f4", fournisseur: "Nettoyage Pro",      type: "Attestation URSSAF", statut: "ok",            dateTraitement: "2025-03-05T09:00:00Z", anomalies: 0 },
  { id: "FA-2025-IMP-01",     fournisseurId: "f5", fournisseur: "Imprimerie Dupont",  type: "Facture",            statut: "ok",            dateTraitement: "2025-03-10T16:00:00Z", anomalies: 0 },
  { id: "FA-2025-IMP-02",     fournisseurId: "f5", fournisseur: "Imprimerie Dupont",  type: "Facture",            statut: "ok",            dateTraitement: "2025-03-10T16:00:00Z", anomalies: 0 },
  { id: "ATT-URSSAF-2025-IMP",fournisseurId: "f5", fournisseur: "Imprimerie Dupont",  type: "Attestation URSSAF", statut: "ok",            dateTraitement: "2025-03-06T08:00:00Z", anomalies: 0 },
  { id: "FA-2025-SITL-01",    fournisseurId: "f6", fournisseur: "Services IT Lemaire",type: "Facture",            statut: "ok",            dateTraitement: "2025-03-11T10:15:00Z", anomalies: 0 },
  { id: "FA-2025-SITL-02",    fournisseurId: "f6", fournisseur: "Services IT Lemaire",type: "Facture",            statut: "ok",            dateTraitement: "2025-03-11T10:15:00Z", anomalies: 0 },
  { id: "CONTRAT-2024-SITL",  fournisseurId: "f6", fournisseur: "Services IT Lemaire",type: "Contrat",            statut: "ok",            dateTraitement: "2025-02-20T09:00:00Z", anomalies: 0 },
];
