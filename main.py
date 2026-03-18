from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ocr.api import router as ocr_router
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
UPLOAD_DIR  = "data/uploads"



app_state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MONGODB_URL:
        raise RuntimeError("MONGODB_URL non définie")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
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

app.include_router(ocr_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["*"],
    allow_headers=["*"],
)

#app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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
        await app_state["mongodb_client"].admin.command("ping")
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



