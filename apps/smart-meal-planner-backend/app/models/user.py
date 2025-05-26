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
    # Basic settings
    servingsPerMeal: Optional[int] = Field(default=1, ge=1, le=10)
    prepComplexity: Optional[int] = Field(default=50, ge=0, le=100)
    snacksPerDay: Optional[int] = Field(default=1, ge=0, le=3)
    
    # Appliances (nested object)
    appliances: Optional[Dict[str, bool]] = None
    
    # Diet types (nested object with multiple selections)
    dietTypes: Optional[Dict[str, bool]] = None
    otherDietType: Optional[str] = None
    
    # Recipe types (nested object with cuisine selections)
    recipeTypes: Optional[Dict[str, bool]] = None
    otherRecipeType: Optional[str] = None
    
    # Text preferences
    dietaryRestrictions: Optional[str] = None
    dislikedIngredients: Optional[str] = None
    
    # Meal times (nested object)
    mealTimes: Optional[Dict[str, bool]] = None
    
    # Macro goals (nested object)
    macroGoals: Optional[Dict[str, Union[int, str]]] = None
    
    # Kroger credentials
    krogerUsername: Optional[str] = None
    krogerPassword: Optional[str] = None
    
    # Advanced preferences (matching individual user model)
    flavorPreferences: Optional[Dict[str, bool]] = None
    spiceLevel: Optional[str] = None
    recipeTypePreferences: Optional[Dict[str, bool]] = None
    mealTimePreferences: Optional[Dict[str, bool]] = None
    timeConstraints: Optional[Dict[str, int]] = None
    prepPreferences: Optional[Dict[str, bool]] = None
    
    # Legacy field mapping for backward compatibility
    diet_type: Optional[str] = None  # Will be converted from dietTypes
    recipe_type: Optional[str] = None  # Will be converted from recipeTypes
    dietary_restrictions: Optional[str] = None  # Alias for dietaryRestrictions
    disliked_ingredients: Optional[str] = None  # Alias for dislikedIngredients
    meal_times: Optional[Dict[str, bool]] = None  # Alias for mealTimes
    macro_protein: Optional[int] = None  # Will be extracted from macroGoals
    macro_carbs: Optional[int] = None  # Will be extracted from macroGoals
    macro_fat: Optional[int] = None  # Will be extracted from macroGoals
    calorie_goal: Optional[int] = None  # Will be extracted from macroGoals
    kroger_username: Optional[str] = None  # Alias for krogerUsername
    kroger_password: Optional[str] = None  # Alias for krogerPassword
    prep_complexity: Optional[int] = None  # Alias for prepComplexity
    servings_per_meal: Optional[int] = None  # Alias for servingsPerMeal
    snacks_per_day: Optional[int] = None  # Alias for snacksPerDay
    flavor_preferences: Optional[Dict[str, bool]] = None  # Alias for flavorPreferences
    recipe_type_preferences: Optional[Dict[str, bool]] = None  # Alias for recipeTypePreferences
    meal_time_preferences: Optional[Dict[str, bool]] = None  # Alias for mealTimePreferences
    time_constraints: Optional[Dict[str, int]] = None  # Alias for timeConstraints
    prep_preferences: Optional[Dict[str, bool]] = None  # Alias for prepPreferences


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

class OrganizationSettingsUpdate(BaseModel):
    # Default Client Preferences (uses same structure as individual preferences)
    default_client_preferences: Optional[Dict[str, Any]] = None
    
    # Client Management Settings
    max_client_capacity: Optional[int] = None
    invitation_approval_required: Optional[bool] = None
    auto_assign_default_preferences: Optional[bool] = None
    
    # Basic Organization Information
    business_type: Optional[str] = None  # 'nutritionist', 'meal_prep', 'corporate_wellness', 'healthcare'
    service_area: Optional[str] = None
    operating_hours: Optional[Dict[str, Any]] = None
    timezone: Optional[str] = None
    
    # Contact and Profile
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None

class OrganizationSettings(BaseModel):
    id: int
    organization_id: int
    default_client_preferences: Dict[str, Any]
    max_client_capacity: Optional[int]
    invitation_approval_required: bool
    auto_assign_default_preferences: bool
    business_type: Optional[str]
    service_area: Optional[str]
    operating_hours: Dict[str, Any]
    timezone: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    website_url: Optional[str]
    logo_url: Optional[str]
    created_at: datetime
    updated_at: datetime

# Onboarding Forms Models
class FormFieldDefinition(BaseModel):
    """Definition of a single form field"""
    id: str
    type: str  # 'text', 'textarea', 'select', 'radio', 'checkbox', 'number', 'email', 'date'
    label: str
    placeholder: Optional[str] = None
    required: bool = False
    options: Optional[List[str]] = None  # For select, radio, checkbox fields
    validation: Optional[Dict[str, Any]] = None  # Custom validation rules
    help_text: Optional[str] = None

class OnboardingFormCreate(BaseModel):
    """Model for creating a new onboarding form"""
    name: str
    description: Optional[str] = None
    is_active: bool = True
    is_required: bool = False
    form_fields: List[FormFieldDefinition]
    settings: Optional[Dict[str, Any]] = {}

class OnboardingFormUpdate(BaseModel):
    """Model for updating an onboarding form"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_required: Optional[bool] = None
    form_fields: Optional[List[FormFieldDefinition]] = None
    settings: Optional[Dict[str, Any]] = None

class OnboardingForm(BaseModel):
    """Complete onboarding form model"""
    id: int
    organization_id: int
    name: str
    description: Optional[str]
    is_active: bool
    is_required: bool
    form_fields: List[FormFieldDefinition]
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]

class OnboardingResponseSubmit(BaseModel):
    """Model for submitting form responses"""
    form_id: int
    response_data: Dict[str, Any]

class OnboardingResponse(BaseModel):
    """Complete onboarding response model"""
    id: int
    form_id: int
    client_id: int
    organization_id: int
    response_data: Dict[str, Any]
    status: str
    completed_at: datetime
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    notes: Optional[str]