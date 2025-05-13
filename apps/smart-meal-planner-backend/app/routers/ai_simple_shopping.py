from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import os
import openai
from app.utils.auth_middleware import get_current_user
from app.models.user import User

# Create router
router = APIRouter()

# OpenAI configuration - get API key from environment
openai.api_key = os.getenv("OPENAI_API_KEY")

# Model for request
class ShoppingListRequest(BaseModel):
    menu_text: str
    model: Optional[str] = "gpt-4"

# Model for shopping list item
class ShoppingListItem(BaseModel):
    itemName: str
    quantity: str
    unitOfMeasure: Optional[str] = ""
    category: str

# Response model
class ShoppingListResponse(BaseModel):
    items: List[ShoppingListItem]

@router.post("/ai/simple-shopping-list", response_model=ShoppingListResponse)
async def generate_shopping_list(
    request: ShoppingListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a categorized shopping list from menu text using OpenAI.
    This is a simplified approach that:
    1. Takes plain text menu
    2. Gets OpenAI to parse and categorize
    3. Returns standardized JSON format
    """
    try:
        # Define system prompt
        system_prompt = """You are a helpful assistant that creates grocery shopping lists. 
        Your task is to take a meal plan and convert it into a well-organized, categorized shopping list.
        
        Follow these requirements:
        1. Combine duplicate ingredients, adding up quantities when appropriate
        2. Standardize units of measure to common kitchen units
        3. Ensure quantities make sense for the ingredient (e.g., "3 eggs" not "3 lb eggs")
        4. Categorize each item into one of these departments: Produce, Meat & Seafood, Dairy & Eggs, Grains & Bakery, Pantry, Frozen, Beverages, Snacks, Condiments, Spices & Herbs, Other
        5. Return ONLY a JSON array with this exact structure:
        [
          {
            "itemName": "Clear, specific ingredient name",
            "quantity": "Numeric amount",
            "unitOfMeasure": "Standardized unit",
            "category": "Department category"
          },
          ...
        ]
        
        Do not include any explanations, just the JSON array."""

        # Create messages for OpenAI API
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.menu_text}
        ]

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model=request.model,
            messages=messages,
            temperature=0.1,  # Low temperature for consistency
            max_tokens=4000,
            n=1,
            stop=None,
        )

        # Extract response content
        response_content = response.choices[0].message.content.strip()
        
        # Parse JSON from response
        try:
            # Try to parse as JSON array directly
            items_list = json.loads(response_content)
            
            # Handle case where OpenAI returns a JSON object instead of an array
            if isinstance(items_list, dict) and "items" in items_list:
                items_list = items_list["items"]
                
            # Ensure we have a list
            if not isinstance(items_list, list):
                raise ValueError("Response is not a list")
                
            # Return formatted response
            return {"items": items_list}
            
        except json.JSONDecodeError as e:
            # If direct parsing fails, try to extract JSON from markdown
            import re
            json_match = re.search(r'```json\n(.*?)\n```', response_content, re.DOTALL)
            
            if json_match:
                items_list = json.loads(json_match.group(1))
                return {"items": items_list}
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to parse OpenAI response as JSON: {str(e)}"
                )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating shopping list: {str(e)}"
        )