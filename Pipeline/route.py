import os
import sys
import subprocess
import uvicorn
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from pipeline import run_pipeline
import logging

# --- Automatisation des dépendances ---
def install_dependencies():
    print("Vérification et installation des dépendances...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    except Exception as e:
        print(f"Erreur lors de l'installation : {e}")

install_dependencies()

# --- Configuration du logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

app = FastAPI(title="OCR Pipeline API")

# Configuration CORS pour permettre les appels depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# État de la dernière exécution
last_run_result = {"status": "idle", "message": "En attente de lancement"}

@app.get("/")
async def root():
    return {"message": "Serveur de Pipeline OCR prêt"}

@app.get("/status")
async def get_status():
    return last_run_result

class LLMRunRequest(BaseModel):
    api_key: str

@app.post("/run")
async def trigger_run():
    """
    Lance le pipeline de manière synchrone (pour un hackathon, on attend le résultat)
    Version Base (Regex)
    """
    global last_run_result
    last_run_result = {"status": "running", "message": "Traitement en cours (Regex)..."}
    try:
        result = run_pipeline(strategy="regex")
        last_run_result = result
        return result
    except Exception as e:
        error_msg = {"status": "error", "message": str(e)}
        last_run_result = error_msg
        return JSONResponse(status_code=500, content=error_msg)

@app.post("/run-llm")
async def trigger_run_llm(req: LLMRunRequest):
    """
    Lance le pipeline avec la stratégie LLM (Mammouth/Gemini)
    """
    global last_run_result
    last_run_result = {"status": "running", "message": "Traitement en cours (LLM)..."}
    try:
        result = run_pipeline(strategy="llm", api_key=req.api_key)
        last_run_result = result
        return result
    except Exception as e:
        error_msg = {"status": "error", "message": str(e)}
        last_run_result = error_msg
        return JSONResponse(status_code=500, content=error_msg)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
