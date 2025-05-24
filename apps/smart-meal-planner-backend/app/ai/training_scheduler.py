# app/ai/training_scheduler.py
import os
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def should_train_model():
    """
    Check if the model should be trained
    
    Returns:
        Dictionary with training decision info
    """
    state_file = os.path.join(os.path.dirname(__file__), "training_state.json")
    
    # Default return value
    result = {
        "should_train": False,
        "reason": "No training needed",
        "last_trained": None
    }
    
    # If state file doesn't exist, we should train
    if not os.path.exists(state_file):
        return {
            "should_train": True,
            "reason": "No training state found",
            "last_trained": None
        }
    
    # Load training state
    try:
        with open(state_file, 'r') as f:
            state = json.load(f)
        
        # Extract last training timestamp
        last_trained = state.get("last_trained")
        if last_trained:
            try:
                last_trained_dt = datetime.fromisoformat(last_trained)
                days_since_last_train = (datetime.now() - last_trained_dt).days
                
                result["last_trained"] = last_trained
                
                # Check if we should train based on time elapsed
                if days_since_last_train > 14:  # 2 weeks
                    return {
                        "should_train": True,
                        "reason": f"Last trained {days_since_last_train} days ago",
                        "last_trained": last_trained
                    }
            except Exception as e:
                logger.error(f"Error parsing last_trained date: {str(e)}")
                
        # Check if we should train based on recipe count
        current_recipe_count = state.get("recipe_count", 0)
        last_recipe_count = state.get("last_recipe_count", 0)
        
        if current_recipe_count - last_recipe_count >= 50:  # 50 new recipes
            return {
                "should_train": True,
                "reason": f"New recipes available ({current_recipe_count - last_recipe_count})",
                "last_trained": last_trained
            }
            
    except Exception as e:
        logger.error(f"Error checking training state: {str(e)}")
        return {
            "should_train": False,
            "reason": f"Error: {str(e)}",
            "last_trained": None
        }
    
    return result

def train_if_needed():
    """
    Check if model training is needed and train if it is
    
    Returns:
        Dictionary with training result
    """
    # Check if we should train
    training_check = should_train_model()
    
    if not training_check["should_train"]:
        logger.info(f"Model training not needed: {training_check['reason']}")
        return {
            "status": "skipped",
            "message": training_check["reason"]
        }
    
    # For the purposes of our multi-user app, don't actually train
    # In the real implementation, we would call the training logic
    logger.info("Model training would normally happen here")
    
    # Update the training state as if we trained
    state_file = os.path.join(os.path.dirname(__file__), "training_state.json")
    
    try:
        # Get current recipe count
        from ..db import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scraped_recipes")
        recipe_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        # Load existing state or create new one
        state = {}
        if os.path.exists(state_file):
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
            except:
                pass
        
        # Update state
        state.update({
            "last_trained": datetime.now().isoformat(),
            "last_recipe_count": recipe_count,
            "recipe_count": recipe_count,
            "status": "completed"
        })
        
        # Save updated state
        with open(state_file, 'w') as f:
            json.dump(state, f)
        
        return {
            "status": "completed",
            "message": "Training completed successfully (simulated)",
            "recipe_count": recipe_count
        }
        
    except Exception as e:
        logger.error(f"Error updating training state: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }