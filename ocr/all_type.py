import base64
import io
import os

from openai import OpenAI
from PIL import Image


SYSTEM_PROMPT = """
Tu es un moteur d'extraction de documents spécialisé dans les factures, devis, bons de commande et documents administratifs.

Objectif :
Extraire proprement le contenu utile du document fourni.

Règles impératives :
- N'invente aucune donnée
- N'ajoute aucun commentaire
- N'explique pas ce que tu fais
- Restitue uniquement les informations extraites
- Si le document contient un tableau, restitue-le de manière lisible ligne par ligne
- Si le document contient plusieurs blocs (facturation, livraison, TVA, total, références, coordonnées), sépare-les clairement
- Si une donnée est illisible, laisse-la vide plutôt que d'inventer
- Conserve les montants, devises, dates, références et intitulés
- Réponds en texte brut uniquement

Format attendu :
DOCUMENT
...
FACTURATION
...
LIVRAISON
...
LIGNES PRODUITS
...
TVA / TOTAL
...
TEXTE COMPLET
...
""".strip()


USER_PROMPT = """
Analyse ce document et extrais proprement les informations visibles.
Le document peut être une facture, un RIB, un devis, un bon de commande, un PDF converti en image, un scan ou une photo.
Retourne uniquement le texte extrait, bien organisé.
""".strip()


def ensure_rgb(image: Image.Image) -> Image.Image:
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def pil_image_to_data_url(image: Image.Image, image_format: str = "PNG") -> str:
    buffer = io.BytesIO()
    image.save(buffer, format=image_format)
    image_bytes = buffer.getvalue()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    mime_type = "image/png"
    if image_format.upper() in {"JPG", "JPEG"}:
        mime_type = "image/jpeg"

    return f"data:{mime_type};base64,{image_b64}"


def parse_document_with_ai(
    image: Image.Image,
    filename: str = "document",
    model: str | None = None,
) -> str:
    """
    Fallback universel via OpenAI GPT vision.
    Retourne un texte extrait proprement.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY manquant")

    model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    image = ensure_rgb(image)
    image_data_url = pil_image_to_data_url(image, image_format="PNG")

    client = OpenAI(api_key=api_key)

    response = client.responses.create(
        model=model,
        temperature=0,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": SYSTEM_PROMPT,
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"Nom du fichier: {filename}",
                    },
                    {
                        "type": "input_text",
                        "text": USER_PROMPT,
                    },
                    {
                        "type": "input_image",
                        "image_url": image_data_url,
                        "detail": "high",
                    },
                ],
            },
        ],
    )

    # Le SDK expose généralement output_text pour le texte final
    text = getattr(response, "output_text", None)
    if text and text.strip():
        return text.strip()

    # fallback défensif si besoin
    try:
        return str(response.output[0].content[0].text).strip()
    except Exception as exc:
        raise RuntimeError("Réponse OpenAI inattendue ou vide") from exc