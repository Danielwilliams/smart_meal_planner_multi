from sqlalchemy import Column, Integer, Text
from . import Base

class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_json = Column(Text, nullable=False)  # storing JSON as text
