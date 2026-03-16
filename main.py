from fastapi import FastAPI, UploadFile, File, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import pytesseract
from PIL import Image
import io
import os
from datetime import datetime

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "ocr_database")

app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
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

@app.get("/")
async def root():
    return {
        "message": "FastAPI OCR Service",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "ocr": "/ocr (POST)",
            "documents": "/documents (GET)"
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
        
        document = {
            "filename": file.filename,
            "text": text,
            "timestamp": datetime.utcnow(),
            "content_type": file.content_type
        }
        
        result = await app_state["db"].ocr_results.insert_one(document)
        
        return {
            "id": str(result.inserted_id),
            "filename": file.filename,
            "text": text,
            "timestamp": document["timestamp"].isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du traitement: {str(e)}")

@app.get("/documents")
async def get_documents(limit: int = 10):
    try:
        cursor = app_state["db"].ocr_results.find().sort("timestamp", -1).limit(limit)
        documents = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["timestamp"] = doc["timestamp"].isoformat()
            documents.append(doc)
        
        return {
            "count": len(documents),
            "documents": documents
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération: {str(e)}")
