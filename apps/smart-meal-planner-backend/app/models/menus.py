from sqlalchemy import Column, Integer, Text
from . import Base
from typing import Dict, Any, Optional
from pydantic import BaseModel

class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_json = Column(Text, nullable=False)  # storing JSON as text
    
    
class SaveMenuRequest(BaseModel):
    user_id: int
    meal_plan: Dict[str, Any]
    nickname: Optional[str] = None
    for_client_id: Optional[int] = None
