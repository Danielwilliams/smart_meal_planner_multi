from pydantic_settings import BaseSettings
from pydantic import EmailStr , Field, BaseModel, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class UserProgress(BaseModel):
    has_preferences: Optional[bool] = None
    has_generated_menu: Optional[bool] = None
    has_shopping_list: Optional[bool] = None

class UserProfileResponse(BaseModel):
    id: int
    email: str
    profile_complete: bool
    has_preferences: bool
    has_generated_menu: bool
    has_shopping_list: bool
    created_at: datetime
    updated_at: Optional[datetime]

class UserSignUp(BaseModel):
    name: str
    email: EmailStr
    password: str
    captchaToken: str
    account_type: str = "individual"  # Can be "individual" or "organization"
    organization_name: Optional[str] = None  # Only needed for organization accounts

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Define request model
class ResendVerificationRequest(BaseModel):
    email: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str

class PreferencesUpdate(BaseModel):
    diet_type: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    disliked_ingredients: Optional[str] = None
    recipe_type: Optional[str] = None
    macro_protein: Optional[int] = None
    macro_carbs: Optional[int] = None
    macro_fat: Optional[int] = None
    calorie_goal: Optional[int] = None
    meal_times: Optional[Dict[str, bool]] = None
    kroger_username: Optional[str] = None
    kroger_password: Optional[str] = None
    appliances: Optional[Dict[str, bool]] = None
    prep_complexity: Optional[int] = None
    servings_per_meal: Optional[int] = Field(default=1, ge=1, le=10)
    snacks_per_day: Optional[int] = Field(default=0, ge=0, le=3)
    flavor_preferences: Optional[Dict[str, bool]] = None
    spice_level: Optional[str] = None
    recipe_type_preferences: Optional[Dict[str, bool]] = None
    meal_time_preferences: Optional[Dict[str, bool]] = None
    time_constraints: Optional[Dict[str, int]] = None
    prep_preferences: Optional[Dict[str, bool]] = None


class GenerateMenuRequest(BaseModel):
    meal_types: List[str]  # e.g. ["breakfast", "lunch", "dinner"]

from typing import Union, List, Dict, Optional
from pydantic import BaseModel, Field, validator

class GenerateMealPlanRequest(BaseModel):
    user_id: int
    duration_days: int = Field(default=7, ge=1, le=7)
    for_client_id: Optional[int] = None  # ID of the client this menu is generated for
    
    # Explicitly define fields to match the desired output
    diet_type: Optional[str] = Field(default="Mixed")
    dietary_preferences: List[str] = Field(default_factory=list)
    disliked_foods: List[str] = Field(default_factory=list)
    
    # Meal and nutrition specifics
    meal_times: List[str] = Field(default_factory=lambda: ["breakfast", "lunch", "dinner"])
    snacks_per_day: int = Field(default=0, ge=0, le=3)
    servings_per_meal: int = Field(default=1, ge=1, le=10)  # Increased limit to 10
    
    # Nutritional goals
    calorie_goal: int = Field(default=2000, ge=500, le=5000)
    macro_protein: int = Field(default=40, ge=10, le=60)
    macro_carbs: int = Field(default=30, ge=10, le=60)
    macro_fat: int = Field(default=30, ge=10, le=60)
    
    # Modify recipe_type to handle both string and list
    recipe_type: Union[str, List[str]] = Field(default_factory=lambda: ["Mixed"])

    appliances: Dict[str, bool] = Field(
        default_factory=lambda: {
            "airFryer": False, 
            "instapot": False, 
            "crockpot": False
        }
    )
    prep_complexity: int = Field(default=50, ge=0, le=100)
    
    # AI model selection
    ai_model: Optional[str] = Field(default="default")

    # Validator to convert string to list
    @validator('recipe_type', pre=True)
    def convert_recipe_type(cls, v):
        if isinstance(v, str):
            return [type.strip() for type in v.split(',')]
        return v

    # Validator to ensure unique list items
    @validator('recipe_type')
    def deduplicate_recipe_type(cls, v):
        return list(dict.fromkeys(v))  # Preserves order while removing duplicates


class UserProfileUpdate(BaseModel):
    diet_type: Optional[str]
    disliked_ingredients: Optional[str]
    # ...
    recipe_type: Optional[str]
    macro_calories: Optional[int]
    macro_protein: Optional[int]
    macro_carbs: Optional[int]
    macro_fat: Optional[int]


class KrogerTokenResponse(BaseModel):
    """
    Represents the Kroger token information
    """
    access_token: str
    refresh_token: str
    expires_at: Optional[datetime] = None
    scope: Optional[List[str]] = None

class KrogerStoreLocation(BaseModel):
    """
    Represents a Kroger store location
    """
    location_id: str
    name: str
    address: Dict[str, str]
    distance: Optional[float] = None
    phone_number: Optional[str] = None

class KrogerProductSearchRequest(BaseModel):
    """
    Request model for searching Kroger products
    """
    query: str
    location_id: Optional[str] = None
    limit: int = 20

class KrogerCartItem(BaseModel):
    """
    Represents an item in the Kroger cart
    """
    upc: str
    name: Optional[str] = None
    quantity: int = 1
    price: Optional[float] = None

class KrogerCartAddRequest(BaseModel):
    """
    Request model for adding items to Kroger cart
    """
    location_id: str
    items: List[KrogerCartItem]

class UserKrogerConnection(BaseModel):
    """
    Represents a user's Kroger account connection status
    """
    is_connected: bool = False
    store_location_id: Optional[str] = None
    last_synced: Optional[datetime] = None


class SaveRecipeRequest(BaseModel):
    menu_id: Optional[int] = None
    recipe_id: Optional[int] = None
    recipe_name: Optional[str] = None
    day_number: Optional[int] = None
    meal_time: Optional[str] = None
    notes: Optional[str] = None
    # Add fields for scraped recipes
    scraped_recipe_id: Optional[int] = None
    recipe_source: Optional[str] = None
    # Add fields for recipe details
    ingredients: Optional[Dict[str, Any]] = None
    instructions: Optional[List[str]] = None
    macros: Optional[Dict[str, Any]] = None
    complexity_level: Optional[str] = None
    appliance_used: Optional[str] = None
    servings: Optional[int] = None


class OrganizationBase(BaseModel):
    name: str
    description: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class Organization(OrganizationBase):
    id: int
    owner_id: int
    created_at: str

class OrganizationClient(BaseModel):
    organization_id: int
    client_id: int
    role: str = "client"
    status: str = "active"

class UserWithRole(BaseModel):
    id: int
    email: str
    name: str
    profile_complete: bool
    organization_id: Optional[int] = None
    role: Optional[str] = None

class ClientInvitation(BaseModel):
    email: str

class InvitationResponse(BaseModel):
    message: str
    invitation_id: int