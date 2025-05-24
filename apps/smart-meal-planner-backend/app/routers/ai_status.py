# app/routers/ai_status.py
from fastapi import APIRouter, Path
import os
from pathlib import Path as FilePath
import logging
import threading
from ..ai.training_scheduler import should_train_model, train_if_needed

router = APIRouter(prefix="/ai", tags=["AI"])

logger = logging.getLogger(__name__)

@router.get("/model-status")
async def check_model_status():
    """Check if our AI features are available"""
    try:
        # Check if local model exists
        model_path = FilePath(os.environ.get('RECIPE_MODEL_PATH', './recipe-generation-model'))
        model_exists = model_path.exists() and (model_path / "pytorch_model.bin").exists()
        
        # Check training status
        training_status = should_train_model()
        
        return {
            "isAvailable": True,
            "localModelExists": model_exists,
            "modelPath": str(model_path),
            "needsTraining": training_status["should_train"],
            "trainingReason": training_status["reason"],
            "lastTrained": training_status["last_trained"],
            "message": "AI enhanced generation is available",
            "models": ["default", "enhanced", "hybrid", "local" if model_exists else None]
        }
    except Exception as e:
        logger.error(f"Error checking model status: {str(e)}")
        return {
            "isAvailable": False,
            "message": f"Error checking AI status: {str(e)}"
        }

@router.get("/training-status")
async def get_training_status():
    """Get model training status"""
    try:
        # Check if training state file exists
        state_file = FilePath("./training_state.json")
        
        if not state_file.exists():
            return {
                "last_trained": None,
                "recipe_count": 0,
                "status": "never_trained",
                "next_training_check": "soon"
            }
        
        # Load training state
        import json
        with open(state_file, 'r') as f:
            state = json.load(f)
            
        # Check if we should train
        training_check = should_train_model()
        
        return {
            "last_trained": state.get("last_trained"),
            "recipe_count": state.get("recipe_count", 0),
            "status": state.get("status", "unknown"),
            "should_train": training_check["should_train"],
            "training_reason": training_check["reason"]
        }
    
    except Exception as e:
        logger.error(f"Error checking training status: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.post("/trigger-training")
async def trigger_model_training(force: bool = False):
    """Trigger model training manually"""
    try:
        # Check if we should train
        training_check = should_train_model()
        
        if not force and not training_check["should_train"]:
            return {
                "status": "skipped",
                "message": f"Training not needed: {training_check['reason']}",
                "last_trained": training_check["last_trained"]
            }
        
        # Trigger training in a background thread
        def run_training():
            train_if_needed()
        
        training_thread = threading.Thread(target=run_training)
        training_thread.start()
        
        return {
            "status": "started",
            "message": "Training started in background"
        }
    
    except Exception as e:
        logger.error(f"Error triggering training: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }