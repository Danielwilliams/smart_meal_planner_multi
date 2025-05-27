# app/routers/organization_branding.py

from fastapi import APIRouter, HTTPException, Depends, status
from app.db import get_db_connection
from app.models.branding import (
    OrganizationBranding, OrganizationBrandingUpdate, OrganizationBrandingResponse,
    BrandingPreviewRequest, BrandingPreviewResponse
)
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/organization-branding", tags=["organization-branding"])
logger = logging.getLogger(__name__)

def get_user_organization_id(user_id: int) -> int:
    """Get the organization ID for a user, ensuring they are an organization owner"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user owns an organization
            cur.execute("""
                SELECT id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: User is not an organization owner"
                )
            return result[0]
    finally:
        conn.close()

@router.get("/{organization_id}/branding", response_model=OrganizationBrandingResponse)
async def get_organization_branding(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get organization branding settings"""
    # Verify user has access to this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT branding_settings, updated_at
                FROM organization_settings
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization settings not found"
                )
            
            branding_settings = result[0] or {}
            updated_at = result[1]
            
            # Ensure all required branding sections exist
            default_branding = {
                "visual": {
                    "primaryColor": "#4caf50",
                    "secondaryColor": "#ff9800",
                    "accentColor": "#2196f3",
                    "logoUrl": None,
                    "faviconUrl": None,
                    "backgroundImageUrl": None,
                    "fontFamily": "Roboto",
                    "customCSS": ""
                },
                "layout": {
                    "headerStyle": "standard",
                    "sidebarStyle": "full",
                    "cardStyle": "rounded",
                    "buttonStyle": "filled"
                },
                "messaging": {
                    "platformName": None,
                    "tagline": None,
                    "footerText": None,
                    "supportEmail": None,
                    "supportPhone": None
                },
                "features": {
                    "showPoweredBy": True,
                    "hideDefaultLogo": False,
                    "customDomain": None
                }
            }
            
            # Merge with defaults to ensure all fields exist
            for section, default_values in default_branding.items():
                if section not in branding_settings:
                    branding_settings[section] = default_values
                else:
                    for key, default_value in default_values.items():
                        if key not in branding_settings[section]:
                            branding_settings[section][key] = default_value
            
            return {
                "organization_id": organization_id,
                "branding": branding_settings,
                "updated_at": updated_at
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization branding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get organization branding"
        )
    finally:
        conn.close()

@router.put("/{organization_id}/branding", response_model=OrganizationBrandingResponse)
async def update_organization_branding(
    organization_id: int,
    branding_data: OrganizationBrandingUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update organization branding settings"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get current branding settings
            logger.error(f"Attempting to get branding for organization {organization_id}")
            
            # First check if the column exists
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'organization_settings' 
                AND column_name = 'branding_settings'
            """)
            column_exists = cur.fetchone()
            logger.error(f"Branding settings column exists: {column_exists is not None}")
            
            if not column_exists:
                # Column doesn't exist - run migration
                logger.error("Branding settings column missing - attempting to add it")
                try:
                    cur.execute("ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS branding_settings JSONB DEFAULT '{}'")
                    conn.commit()
                    logger.error("Added branding_settings column")
                except Exception as add_column_error:
                    logger.error(f"Failed to add branding_settings column: {add_column_error}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database schema issue: {str(add_column_error)}"
                    )
            
            cur.execute("""
                SELECT branding_settings
                FROM organization_settings
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization settings not found"
                )
            
            current_branding = result[0] or {}
            logger.error(f"Current branding settings: {current_branding}")
            logger.error(f"Incoming branding data: {branding_data}")
            
            # Update only provided sections
            if branding_data.visual:
                logger.error("Updating visual settings")
                current_branding['visual'] = {
                    **current_branding.get('visual', {}),
                    **branding_data.visual.dict(exclude_unset=True)
                }
            
            if branding_data.layout:
                current_branding['layout'] = {
                    **current_branding.get('layout', {}),
                    **branding_data.layout.dict(exclude_unset=True)
                }
                
            if branding_data.messaging:
                current_branding['messaging'] = {
                    **current_branding.get('messaging', {}),
                    **branding_data.messaging.dict(exclude_unset=True)
                }
                
            if branding_data.features:
                current_branding['features'] = {
                    **current_branding.get('features', {}),
                    **branding_data.features.dict(exclude_unset=True)
                }
            
            # Update the database
            logger.error(f"Final branding settings to save: {current_branding}")
            try:
                cur.execute("""
                    UPDATE organization_settings 
                    SET branding_settings = %s
                    WHERE organization_id = %s
                    RETURNING branding_settings, updated_at
                """, (json.dumps(current_branding), organization_id))
                logger.error("Database update executed successfully")
            except Exception as db_error:
                logger.error(f"Database update failed: {db_error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database update failed: {str(db_error)}"
                )
            
            result = cur.fetchone()
            conn.commit()
            
            return {
                "organization_id": organization_id,
                "branding": result[0],
                "updated_at": result[1]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating organization branding: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update organization branding"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/branding/public")
async def get_public_branding(organization_id: int):
    """Get public branding settings (no authentication required for client-facing pages)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT branding_settings
                FROM organization_settings
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                # Return default branding if organization not found
                return {
                    "visual": {
                        "primaryColor": "#4caf50",
                        "secondaryColor": "#ff9800",
                        "logoUrl": None,
                        "fontFamily": "Roboto"
                    },
                    "messaging": {
                        "platformName": "Smart Meal Planner"
                    }
                }
            
            branding_settings = result[0] or {}
            
            # Return only public-safe branding information
            public_branding = {
                "visual": {
                    "primaryColor": branding_settings.get('visual', {}).get('primaryColor', '#4caf50'),
                    "secondaryColor": branding_settings.get('visual', {}).get('secondaryColor', '#ff9800'),
                    "accentColor": branding_settings.get('visual', {}).get('accentColor', '#2196f3'),
                    "logoUrl": branding_settings.get('visual', {}).get('logoUrl'),
                    "fontFamily": branding_settings.get('visual', {}).get('fontFamily', 'Roboto'),
                    "customCSS": branding_settings.get('visual', {}).get('customCSS', '')
                },
                "layout": branding_settings.get('layout', {}),
                "messaging": {
                    "platformName": branding_settings.get('messaging', {}).get('platformName'),
                    "tagline": branding_settings.get('messaging', {}).get('tagline'),
                    "footerText": branding_settings.get('messaging', {}).get('footerText'),
                    "supportEmail": branding_settings.get('messaging', {}).get('supportEmail'),
                    "supportPhone": branding_settings.get('messaging', {}).get('supportPhone')
                },
                "features": {
                    "showPoweredBy": branding_settings.get('features', {}).get('showPoweredBy', True),
                    "hideDefaultLogo": branding_settings.get('features', {}).get('hideDefaultLogo', False)
                }
            }
            
            return public_branding
            
    except Exception as e:
        logger.error(f"Error getting public branding: {str(e)}")
        # Return default branding on error
        return {
            "visual": {
                "primaryColor": "#4caf50",
                "secondaryColor": "#ff9800",
                "logoUrl": None,
                "fontFamily": "Roboto"
            },
            "messaging": {
                "platformName": "Smart Meal Planner"
            }
        }
    finally:
        conn.close()

@router.post("/{organization_id}/branding/preview", response_model=BrandingPreviewResponse)
async def create_branding_preview(
    organization_id: int,
    preview_request: BrandingPreviewRequest,
    current_user = Depends(get_user_from_token)
):
    """Create a temporary preview of branding changes"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    try:
        # Generate a unique preview ID
        preview_id = str(uuid.uuid4())
        
        # In a real implementation, you would store this in Redis or a cache
        # For now, we'll return a mock preview URL
        preview_url = f"/preview/{preview_id}"
        expires_at = datetime.utcnow().replace(hour=23, minute=59, second=59)
        
        return {
            "preview_url": preview_url,
            "expires_at": expires_at,
            "preview_id": preview_id
        }
        
    except Exception as e:
        logger.error(f"Error creating branding preview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create branding preview"
        )

@router.get("/{organization_id}/branding/reset")
async def reset_organization_branding(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Reset organization branding to default settings"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            default_branding = {
                "visual": {
                    "primaryColor": "#4caf50",
                    "secondaryColor": "#ff9800",
                    "accentColor": "#2196f3",
                    "logoUrl": None,
                    "faviconUrl": None,
                    "backgroundImageUrl": None,
                    "fontFamily": "Roboto",
                    "customCSS": ""
                },
                "layout": {
                    "headerStyle": "standard",
                    "sidebarStyle": "full",
                    "cardStyle": "rounded",
                    "buttonStyle": "filled"
                },
                "messaging": {
                    "platformName": None,
                    "tagline": None,
                    "footerText": None,
                    "supportEmail": None,
                    "supportPhone": None
                },
                "features": {
                    "showPoweredBy": True,
                    "hideDefaultLogo": False,
                    "customDomain": None
                }
            }
            
            cur.execute("""
                UPDATE organization_settings 
                SET branding_settings = %s
                WHERE organization_id = %s
            """, (json.dumps(default_branding), organization_id))
            
            conn.commit()
            
            return {"message": "Branding settings reset to defaults successfully"}
            
    except Exception as e:
        logger.error(f"Error resetting organization branding: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset organization branding"
        )
    finally:
        conn.close()