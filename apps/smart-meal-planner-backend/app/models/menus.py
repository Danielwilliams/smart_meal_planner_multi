from typing import Dict, Any, Optional
from pydantic import BaseModel

class SaveMenuRequest(BaseModel):
    user_id: int
    meal_plan: Dict[str, Any]
    nickname: Optional[str] = None
    for_client_id: Optional[int] = None