# app/routers/organization_settings.py
from fastapi import APIRouter, HTTPException, Depends, status
from app.db import get_db_connection
from app.models.user import OrganizationSettings, OrganizationSettingsUpdate
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import Dict, Any

router = APIRouter()
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
                    detail="User is not an organization owner"
                )
            
            return result[0]
    finally:
        conn.close()

@router.get("/{organization_id}", response_model=OrganizationSettings)
async def get_organization_settings(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get organization settings - only accessible by organization owner"""
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
            cur.execute("""
                SELECT id, organization_id, default_client_preferences, 
                       max_client_capacity, invitation_approval_required,
                       auto_assign_default_preferences, business_type, 
                       service_area, operating_hours, timezone,
                       contact_email, contact_phone, website_url, logo_url,
                       created_at, updated_at
                FROM organization_settings 
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                # Create default settings if none exist
                cur.execute("""
                    INSERT INTO organization_settings (organization_id)
                    VALUES (%s)
                    RETURNING id, organization_id, default_client_preferences, 
                              max_client_capacity, invitation_approval_required,
                              auto_assign_default_preferences, business_type, 
                              service_area, operating_hours, timezone,
                              contact_email, contact_phone, website_url, logo_url,
                              created_at, updated_at
                """, (organization_id,))
                result = cur.fetchone()
                conn.commit()
            
            return OrganizationSettings(
                id=result[0],
                organization_id=result[1],
                default_client_preferences=result[2] or {},
                max_client_capacity=result[3],
                invitation_approval_required=result[4],
                auto_assign_default_preferences=result[5],
                business_type=result[6],
                service_area=result[7],
                operating_hours=result[8] or {},
                timezone=result[9],
                contact_email=result[10],
                contact_phone=result[11],
                website_url=result[12],
                logo_url=result[13],
                created_at=result[14],
                updated_at=result[15]
            )
    except Exception as e:
        logger.error(f"Error fetching organization settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch organization settings"
        )
    finally:
        conn.close()

@router.put("/{organization_id}", response_model=OrganizationSettings)
async def update_organization_settings(
    organization_id: int,
    settings_update: OrganizationSettingsUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update organization settings - only accessible by organization owner"""
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
            # Build dynamic update query
            update_fields = []
            update_values = []
            
            if settings_update.default_client_preferences is not None:
                update_fields.append("default_client_preferences = %s")
                update_values.append(json.dumps(settings_update.default_client_preferences))
            
            if settings_update.max_client_capacity is not None:
                update_fields.append("max_client_capacity = %s")
                update_values.append(settings_update.max_client_capacity)
            
            if settings_update.invitation_approval_required is not None:
                update_fields.append("invitation_approval_required = %s")
                update_values.append(settings_update.invitation_approval_required)
            
            if settings_update.auto_assign_default_preferences is not None:
                update_fields.append("auto_assign_default_preferences = %s")
                update_values.append(settings_update.auto_assign_default_preferences)
            
            if settings_update.business_type is not None:
                update_fields.append("business_type = %s")
                update_values.append(settings_update.business_type)
            
            if settings_update.service_area is not None:
                update_fields.append("service_area = %s")
                update_values.append(settings_update.service_area)
            
            if settings_update.operating_hours is not None:
                update_fields.append("operating_hours = %s")
                update_values.append(json.dumps(settings_update.operating_hours))
            
            if settings_update.timezone is not None:
                update_fields.append("timezone = %s")
                update_values.append(settings_update.timezone)
            
            if settings_update.contact_email is not None:
                update_fields.append("contact_email = %s")
                update_values.append(settings_update.contact_email)
            
            if settings_update.contact_phone is not None:
                update_fields.append("contact_phone = %s")
                update_values.append(settings_update.contact_phone)
            
            if settings_update.website_url is not None:
                update_fields.append("website_url = %s")
                update_values.append(settings_update.website_url)
            
            if settings_update.logo_url is not None:
                update_fields.append("logo_url = %s")
                update_values.append(settings_update.logo_url)
            
            if not update_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            # Add organization_id to values
            update_values.append(organization_id)
            
            # Execute update
            update_query = f"""
                UPDATE organization_settings 
                SET {', '.join(update_fields)}
                WHERE organization_id = %s
                RETURNING id, organization_id, default_client_preferences, 
                          max_client_capacity, invitation_approval_required,
                          auto_assign_default_preferences, business_type, 
                          service_area, operating_hours, timezone,
                          contact_email, contact_phone, website_url, logo_url,
                          created_at, updated_at
            """
            
            cur.execute(update_query, update_values)
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization settings not found"
                )
            
            conn.commit()
            
            return OrganizationSettings(
                id=result[0],
                organization_id=result[1],
                default_client_preferences=result[2] or {},
                max_client_capacity=result[3],
                invitation_approval_required=result[4],
                auto_assign_default_preferences=result[5],
                business_type=result[6],
                service_area=result[7],
                operating_hours=result[8] or {},
                timezone=result[9],
                contact_email=result[10],
                contact_phone=result[11],
                website_url=result[12],
                logo_url=result[13],
                created_at=result[14],
                updated_at=result[15]
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating organization settings: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update organization settings"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/default-preferences")
async def get_default_client_preferences(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get default client preferences for an organization"""
    # Verify user has access to this organization (owner or client)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user is owner or client of organization
            cur.execute("""
                SELECT 1 FROM organizations WHERE id = %s AND owner_id = %s
                UNION
                SELECT 1 FROM organization_clients oc 
                JOIN user_profiles up ON oc.client_id = up.id
                WHERE oc.organization_id = %s AND up.id = %s AND oc.status = 'active'
            """, (organization_id, current_user['user_id'], organization_id, current_user['user_id']))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this organization"
                )
            
            # Get default preferences
            cur.execute("""
                SELECT default_client_preferences, auto_assign_default_preferences
                FROM organization_settings 
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                return {"default_client_preferences": {}, "auto_assign_default_preferences": True}
            
            return {
                "default_client_preferences": result[0] or {},
                "auto_assign_default_preferences": result[1]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching default client preferences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch default preferences"
        )
    finally:
        conn.close()