# app/routers/ai_status.py
from fastapi import APIRouter, Path, Depends, HTTPException
import os
from pathlib import Path as FilePath
import logging
import threading
import time
from typing import Dict, Any
from ..ai.training_scheduler import should_train_model, train_if_needed
from ..db import get_db_cursor, get_connection_stats, close_all_connections
from ..utils.auth_middleware import get_user_from_token

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

@router.get("/db-stats")
async def get_db_connection_stats(user = Depends(get_user_from_token)):
    """Get database connection statistics"""
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required for DB stats")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    # Check if user is admin
    is_admin = user.get('is_admin', False)
    if not is_admin:
        logger.error(f"User {user.get('user_id')} attempted to access DB stats but is not admin")
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    # Get connection stats
    stats = get_connection_stats()

    # Test a database query to verify connection
    connection_test = "failed"
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            cur.execute("SELECT 1 as test")
            result = cur.fetchone()
            if result and result['test'] == 1:
                connection_test = "success"
    except Exception as e:
        connection_test = f"error: {str(e)}"

    return {
        "stats": stats,
        "connection_test": connection_test,
        "timestamp": time.time()
    }

@router.post("/reset-db-connections")
async def reset_db_connections(user = Depends(get_user_from_token)):
    """Reset all database connections"""
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required for DB connection reset")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    # Check if user is admin
    is_admin = user.get('is_admin', False)
    if not is_admin:
        logger.error(f"User {user.get('user_id')} attempted to reset DB connections but is not admin")
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    # Get stats before reset
    before_stats = get_connection_stats()

    # Reset connections
    success = close_all_connections()
    logger.info(f"Database connection pool reset: {success}")

    # Get stats after reset
    after_stats = get_connection_stats()

    return {
        "success": success,
        "before": before_stats,
        "after": after_stats,
        "timestamp": time.time()
    }