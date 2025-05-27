# app/models/branding.py

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class OrganizationBrandingVisual(BaseModel):
    """Visual branding settings for organization"""
    primaryColor: Optional[str] = Field(default="#4caf50", pattern=r"^#[0-9A-Fa-f]{6}$")
    secondaryColor: Optional[str] = Field(default="#ff9800", pattern=r"^#[0-9A-Fa-f]{6}$")
    accentColor: Optional[str] = Field(default="#2196f3", pattern=r"^#[0-9A-Fa-f]{6}$")
    logoUrl: Optional[str] = None
    faviconUrl: Optional[str] = None
    backgroundImageUrl: Optional[str] = None
    fontFamily: Optional[str] = "Roboto"
    customCSS: Optional[str] = ""

    @validator('logoUrl', 'faviconUrl', 'backgroundImageUrl')
    def validate_url(cls, v):
        if v and not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('URL must start with http:// or https://')
        return v

    @validator('fontFamily')
    def validate_font_family(cls, v):
        # Allow common web-safe fonts and Google Fonts
        allowed_fonts = [
            'Roboto', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
            'Verdana', 'Tahoma', 'Open Sans', 'Lato', 'Montserrat', 
            'Source Sans Pro', 'Nunito', 'Poppins'
        ]
        if v and v not in allowed_fonts:
            raise ValueError(f'Font family must be one of: {", ".join(allowed_fonts)}')
        return v

class OrganizationBrandingLayout(BaseModel):
    """Layout and styling preferences"""
    headerStyle: Optional[str] = Field(default="standard", pattern=r"^(standard|minimal|centered)$")
    sidebarStyle: Optional[str] = Field(default="full", pattern=r"^(full|collapsed|hidden)$")
    cardStyle: Optional[str] = Field(default="rounded", pattern=r"^(rounded|square|elevated)$")
    buttonStyle: Optional[str] = Field(default="filled", pattern=r"^(filled|outlined|text)$")

class OrganizationBrandingMessaging(BaseModel):
    """Text and messaging customization"""
    platformName: Optional[str] = Field(None, max_length=100)
    tagline: Optional[str] = Field(None, max_length=200)
    footerText: Optional[str] = Field(None, max_length=200)
    supportEmail: Optional[str] = None
    supportPhone: Optional[str] = Field(None, max_length=20)

    @validator('supportEmail')
    def validate_email(cls, v):
        if v:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError('Invalid email format')
        return v

class OrganizationBrandingFeatures(BaseModel):
    """Feature toggles for branding"""
    showPoweredBy: Optional[bool] = True
    hideDefaultLogo: Optional[bool] = False
    customDomain: Optional[str] = None

    @validator('customDomain')
    def validate_domain(cls, v):
        if v:
            import re
            domain_pattern = r'^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
            if not re.match(domain_pattern, v):
                raise ValueError('Invalid domain format')
        return v

class OrganizationBranding(BaseModel):
    """Complete organization branding configuration"""
    visual: OrganizationBrandingVisual
    layout: OrganizationBrandingLayout
    messaging: OrganizationBrandingMessaging
    features: OrganizationBrandingFeatures

class OrganizationBrandingUpdate(BaseModel):
    """Model for updating organization branding settings"""
    visual: Optional[OrganizationBrandingVisual] = None
    layout: Optional[OrganizationBrandingLayout] = None
    messaging: Optional[OrganizationBrandingMessaging] = None
    features: Optional[OrganizationBrandingFeatures] = None

class OrganizationBrandingResponse(BaseModel):
    """Response model for branding data"""
    organization_id: int
    branding: OrganizationBranding
    updated_at: datetime

# Email Template Models

class EmailTemplateVariables(BaseModel):
    """Available variables for email template types"""
    welcome: List[str] = [
        'client.name', 'client.email', 'organization.name', 
        'organization.logo_url', 'organization.support_email',
        'invitation.sender_name', 'login_url'
    ]
    menu_delivery: List[str] = [
        'client.name', 'menu.week_start', 'menu.week_end',
        'menu.meal_count', 'organization.name', 'menu_link',
        'shopping_list_link', 'organization.support_email'
    ]
    reminder: List[str] = [
        'client.name', 'reminder.type', 'reminder.message',
        'organization.name', 'dashboard_link'
    ]
    notification: List[str] = [
        'client.name', 'notification.title', 'notification.message',
        'organization.name', 'action_link'
    ]

class EmailTemplateCreate(BaseModel):
    """Model for creating email templates"""
    template_type: str = Field(..., pattern=r"^(welcome|menu_delivery|reminder|notification)$")
    name: str = Field(..., max_length=255)
    subject_template: str = Field(..., max_length=500)
    html_template: str
    text_template: Optional[str] = None
    variables: List[str] = []
    is_active: bool = True

class EmailTemplateUpdate(BaseModel):
    """Model for updating email templates"""
    name: Optional[str] = Field(None, max_length=255)
    subject_template: Optional[str] = Field(None, max_length=500)
    html_template: Optional[str] = None
    text_template: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None

class EmailTemplate(BaseModel):
    """Complete email template model"""
    id: int
    organization_id: int
    template_type: str
    name: str
    subject_template: str
    html_template: str
    text_template: Optional[str]
    variables: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: int

class EmailTemplateTestRequest(BaseModel):
    """Model for testing email templates"""
    test_email: str = Field(..., pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    template_data: Dict[str, Any] = {}
    variables: Dict[str, Any] = {}

# Branding Preview Models

class BrandingPreviewRequest(BaseModel):
    """Model for previewing branding changes"""
    branding_data: OrganizationBranding
    preview_type: str = Field(default="dashboard", pattern=r"^(dashboard|email|menu)$")

class BrandingPreviewResponse(BaseModel):
    """Response for branding preview"""
    preview_url: str
    expires_at: datetime
    preview_id: str