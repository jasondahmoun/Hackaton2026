from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from contextlib import asynccontextmanager
import pytesseract
from mongo_init.init import init_mongodb
from PIL import Image
import io, os, uuid, shutil
from datetime import datetime

MONGODB_URL = os.getenv("MONGODB_URL")
MONGODB_DB  = os.getenv("MONGODB_DB", "ocr_database")
UPLOAD_DIR  = "/app/data/uploads"

if not MONGODB_URL:
    raise RuntimeError("MONGODB_URL non définie")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_mongodb()
    app_state["mongodb_client"] = AsyncIOMotorClient(MONGODB_URL)
    app_state["db"] = app_state["mongodb_client"][MONGODB_DB]
    yield
    app_state["mongodb_client"].close()

app = FastAPI(
    title="FastAPI OCR Service",
    description="Service OCR avec MongoDB et Tesseract",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    return {
        "message": "FastAPI OCR Service",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ocr": "/ocr (POST)",
            "documents": "/documents (GET)",
            "document_by_id": "/documents/{id} (GET)",
            "corrections": "/corrections (GET)",
        }
    }

@app.get("/health")
async def health_check():
    try:
        await app_state["mongodb_client"].admin.command('ping')
        mongodb_status = "connected"
    except Exception as e:
        mongodb_status = f"error: {str(e)}"

    tesseract_version = pytesseract.get_tesseract_version()

    return {
        "status": "healthy",
        "mongodb": mongodb_status,
        "tesseract_version": str(tesseract_version),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/ocr")
async def extract_text(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(image, lang='fra')

        # Sauvegarde du fichier sur disque
        ext = os.path.splitext(file.filename)[1] or ".png"
        saved_name = f"{uuid.uuid4()}{ext}"
        saved_path = os.path.join(UPLOAD_DIR, saved_name)
        with open(saved_path, "wb") as f:
            f.write(contents)
        file_url = f"data/uploads/{saved_name}"

        document = {
            "filename": file.filename,
            "text": text,
            "timestamp": datetime.utcnow(),
            "content_type": file.content_type,
            "file_url": file_url,
        }

        result = await app_state["db"].ocr_results.insert_one(document)

        return {
            "id": str(result.inserted_id),
            "filename": file.filename,
            "text": text,
            "timestamp": document["timestamp"].isoformat(),
            "file_url": file_url,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du traitement: {str(e)}")

@app.get("/documents")
async def get_documents(limit: int = 10, search: str = ""):
    try:
        query = {}
        if search:
            query = {"filename": {"$regex": search, "$options": "i"}}

        cursor = app_state["db"].ocr_results.find(query).sort("timestamp", -1).limit(limit)
        documents = []

        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["timestamp"] = doc["timestamp"].isoformat()
            documents.append(doc)

        return {"count": len(documents), "documents": documents}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")

@app.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    try:
        doc = await app_state["db"].ocr_results.find_one({"_id": ObjectId(doc_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Document introuvable")
        doc["_id"] = str(doc["_id"])
        doc["timestamp"] = doc["timestamp"].isoformat()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@app.get("/corrections")
async def get_corrections(limit: int = 50):
    try:
        cursor = app_state["db"].corrections.find().sort("_id", -1).limit(limit)
        corrections = []

        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "original_id" in doc and not isinstance(doc["original_id"], str):
                doc["original_id"] = str(doc["original_id"])
            corrections.append(doc)

        return {"count": len(corrections), "corrections": corrections}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")
