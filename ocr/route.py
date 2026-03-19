from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from bson import ObjectId
from pdf2image import convert_from_bytes
import base64
#from ocr.ocr_pretraitement import preprocess_image
from ocr.pipeline import (
    extract_text_from_image,
    extract_text_from_pdf_bytes,
    extract_text_from_docx_bytes,
)
import uuid
#import pytesseract
from PIL import Image
import io
import os
from datetime import datetime

#  Router FastAPI
router = APIRouter()

def get_db():
    from main import app_state
    return app_state["db"]

def serialize(obj):
    """Convertit récursivement tous les ObjectId et datetime en types JSON-sérialisables."""
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


UPLOAD_DIR = os.getenv("UPLOAD_DIR") or "data/uploads"


@router.post("/documents/upload")
async def upload_and_process(file: UploadFile = File(...)):
    db = get_db()

    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")

    if not file.content_type:
        raise HTTPException(status_code=400, detail="Type de fichier manquant")

    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if not (file.content_type.startswith("image/") or file.content_type in allowed_types):
        raise HTTPException(
            status_code=400,
            detail="Formats acceptés : image/*, application/pdf, .docx"
        )

    fake_user_id = ObjectId("65f000000000000000000001")

    file_extension = os.path.splitext(file.filename)[1]
    generated_name = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, generated_name)

    contents = await file.read()
    file_base64 = base64.b64encode(contents).decode("utf-8")
    file_path = file_base64


    #with open(file_path, "wb") as saved_file:
        #saved_file.write(contents)

    raw_document = {
        "user_id": fake_user_id,
        "title": file.filename.split(".")[0],
        "filename": file.filename,
        "file_url": file_path,
        "status": False,
        "created_at": datetime.utcnow()
    }

    document_insert = await db.documents.insert_one(raw_document)
    document_id = document_insert.inserted_id

    try:
        if file.content_type == "application/pdf":
            extracted_text = extract_text_from_pdf_bytes(
                contents=contents,
                filename=file.filename,
                lang="fra",
            )

        elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            extracted_text = extract_text_from_docx_bytes(contents)

        else:
            image = Image.open(io.BytesIO(contents))
            extracted_text = extract_text_from_image(
                image=image,
                filename=file.filename,
                lang="fra",
            )

        clean_result = {
            "document_id": document_id,
            "title": file.filename.split(".")[0],
            "extracted_text": extracted_text,
            "confidence": None,
            "language": "fr",
            "status": False,
            "created_at": datetime.utcnow()
        }

        await db.ocr_results.insert_one(clean_result)

        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {"status": "processed"}}
        )

        return {
            "message": "Document traité avec succès",
            "document_id": str(document_id),
            "filename": file.filename,
            "raw_zone": {
                "collection": "documents",
                "status": "processed",
                "file_url": file_path
            },
            "clean_zone": {
                "collection": "ocr_results",
                "language": "fr",
                "extracted_text": extracted_text
            }
        }

    except Exception as e:
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"Erreur OCR : {str(e)}")
    
@router.get("/documents")
async def get_documents(limit: int = 10):
    db = get_db()

    try:
        cursor = db.documents.find().sort("created_at", -1).limit(limit)
        documents = []

        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["user_id"] = str(doc["user_id"])
            doc["created_at"] = doc["created_at"].isoformat()
            documents.append(doc)

        return {
            "count": len(documents),
            "documents": documents
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")


@router.get("/documents/{document_id}/ocr")
async def get_ocr_result(document_id: str):
    db = get_db()

    try:
        object_id = ObjectId(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="document_id invalide")

    document = await db.documents.find_one({"_id": object_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document introuvable")

    result = await db.ocr_results.find_one({"document_id": object_id})
    if not result:
        raise HTTPException(status_code=404, detail="Résultat OCR introuvable")

    document["_id"] = str(document["_id"])
    document["user_id"] = str(document["user_id"])
    document["created_at"] = document["created_at"].isoformat()

    result["_id"] = str(result["_id"])
    result["document_id"] = str(result["document_id"])
    result["created_at"] = result["created_at"].isoformat()

    return {
        "document": document,
        "ocr_result": result
    }

@router.get("/documents/{document_id}/file")
async def get_document_file(document_id: str):
    db = get_db()
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="document_id invalide")
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    file_url = doc.get("file_url", "")
    if not os.path.isfile(file_url):
        raise HTTPException(status_code=404, detail=f"Fichier introuvable : {file_url}")
    return FileResponse(file_url)


@router.get("/ocr_results")
async def get_ocr_results(limit: int = 50):
    db = get_db()
    try:
        cursor = db.ocr_results.find().sort("_id", -1).limit(limit)
        results = []
        async for doc in cursor:
            results.append(serialize(doc))
        return {"count": len(results), "ocr_results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur : {str(e)}")


@router.get("/corrections")
async def get_all_corrections(limit: int = 100):
    db = get_db()

    try:
        cursor = db.corrections.find().sort("_id", -1).limit(limit)
        corrections = []

        async for doc in cursor:
            corrections.append(serialize(doc))

        return {
            "count": len(corrections),
            "corrections": corrections
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la récupération des corrections : {str(e)}"
        )


@router.get("/corrections/{original_id}")
async def get_corrections_by_original_id(original_id: str):
    db = get_db()

    try:
        object_id = ObjectId(original_id)
    except Exception:
        raise HTTPException(status_code=400, detail="original_id invalide")

    try:
        cursor = db.correction.find({"original_id": object_id}).sort("created_at", -1)
        corrections = []

        async for doc in cursor:
            doc["_id"] = str(doc["_id"])

            if "original_id" in doc and isinstance(doc["original_id"], ObjectId):
                doc["original_id"] = str(doc["original_id"])

            if "created_at" in doc and doc["created_at"] is not None:
                doc["created_at"] = doc["created_at"].isoformat()

            corrections.append(doc)

        if not corrections:
            raise HTTPException(
                status_code=404,
                detail="Aucune correction trouvée pour cet original_id"
            )

        return {
            "count": len(corrections),
            "original_id": original_id,
            "corrections": corrections
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la récupération des corrections : {str(e)}"
        )