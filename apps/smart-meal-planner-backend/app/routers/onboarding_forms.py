# app/routers/onboarding_forms.py
from fastapi import APIRouter, HTTPException, Depends, status
from app.db import get_db_connection
from app.models.user import (
    OnboardingForm, OnboardingFormCreate, OnboardingFormUpdate,
    OnboardingResponse, OnboardingResponseSubmit, FormFieldDefinition
)
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import List, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/api/onboarding-forms", tags=["onboarding-forms"])
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

@router.get("/{organization_id}")
async def get_organization_forms(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get all onboarding forms for an organization"""
    # Verify user has access to this organization
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user is owner or client of organization
            cur.execute("""
                SELECT 1 FROM organizations WHERE id = %s AND owner_id = %s
                UNION
                SELECT 1 FROM organization_clients oc 
                WHERE oc.organization_id = %s AND oc.client_id = %s AND oc.status = 'active'
            """, (organization_id, current_user['user_id'], organization_id, current_user['user_id']))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this organization"
                )
            
            # Get forms for this organization
            cur.execute("""
                SELECT id, organization_id, name, description, is_active, is_required,
                       form_fields, settings, created_at, updated_at, created_by
                FROM onboarding_forms 
                WHERE organization_id = %s
                ORDER BY created_at DESC
            """, (organization_id,))
            
            forms = []
            for row in cur.fetchall():
                forms.append({
                    "id": row[0],
                    "organization_id": row[1],
                    "name": row[2],
                    "description": row[3],
                    "is_active": row[4],
                    "is_required": row[5],
                    "form_fields": row[6] or [],
                    "settings": row[7] or {},
                    "created_at": row[8],
                    "updated_at": row[9],
                    "created_by": row[10]
                })
            
            return {"forms": forms}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching forms: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch forms"
        )
    finally:
        conn.close()

@router.post("/{organization_id}")
async def create_onboarding_form(
    organization_id: int,
    form_data: OnboardingFormCreate,
    current_user = Depends(get_user_from_token)
):
    """Create a new onboarding form - only accessible by organization owner"""
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
            # Check if form name already exists for this organization
            cur.execute("""
                SELECT id FROM onboarding_forms 
                WHERE organization_id = %s AND name = %s
            """, (organization_id, form_data.name))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Form with this name already exists"
                )
            
            # Convert form fields to JSON
            form_fields_json = json.dumps([field.dict() for field in form_data.form_fields])
            settings_json = json.dumps(form_data.settings)
            
            # Create the form
            cur.execute("""
                INSERT INTO onboarding_forms 
                (organization_id, name, description, is_active, is_required, 
                 form_fields, settings, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at, updated_at
            """, (
                organization_id, form_data.name, form_data.description,
                form_data.is_active, form_data.is_required,
                form_fields_json, settings_json, current_user['user_id']
            ))
            
            result = cur.fetchone()
            form_id = result[0]
            created_at = result[1]
            updated_at = result[2]
            
            conn.commit()
            
            return {
                "id": form_id,
                "organization_id": organization_id,
                "name": form_data.name,
                "description": form_data.description,
                "is_active": form_data.is_active,
                "is_required": form_data.is_required,
                "form_fields": form_data.form_fields,
                "settings": form_data.settings,
                "created_at": created_at,
                "updated_at": updated_at,
                "created_by": current_user['user_id']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating form: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create form"
        )
    finally:
        conn.close()

@router.put("/{organization_id}/{form_id}")
async def update_onboarding_form(
    organization_id: int,
    form_id: int,
    form_update: OnboardingFormUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update an onboarding form - only accessible by organization owner"""
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
            # Verify form exists and belongs to organization
            cur.execute("""
                SELECT id FROM onboarding_forms 
                WHERE id = %s AND organization_id = %s
            """, (form_id, organization_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Form not found"
                )
            
            # Build dynamic update query
            update_fields = []
            update_values = []
            
            if form_update.name is not None:
                update_fields.append("name = %s")
                update_values.append(form_update.name)
            
            if form_update.description is not None:
                update_fields.append("description = %s")
                update_values.append(form_update.description)
            
            if form_update.is_active is not None:
                update_fields.append("is_active = %s")
                update_values.append(form_update.is_active)
            
            if form_update.is_required is not None:
                update_fields.append("is_required = %s")
                update_values.append(form_update.is_required)
            
            if form_update.form_fields is not None:
                update_fields.append("form_fields = %s")
                update_values.append(json.dumps([field.dict() for field in form_update.form_fields]))
            
            if form_update.settings is not None:
                update_fields.append("settings = %s")
                update_values.append(json.dumps(form_update.settings))
            
            if not update_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            # Add form_id to values
            update_values.append(form_id)
            
            # Execute update
            update_query = f"""
                UPDATE onboarding_forms 
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id, organization_id, name, description, is_active, is_required,
                          form_fields, settings, created_at, updated_at, created_by
            """
            
            cur.execute(update_query, update_values)
            result = cur.fetchone()
            
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "name": result[2],
                "description": result[3],
                "is_active": result[4],
                "is_required": result[5],
                "form_fields": result[6] or [],
                "settings": result[7] or {},
                "created_at": result[8],
                "updated_at": result[9],
                "created_by": result[10]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating form: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form"
        )
    finally:
        conn.close()

@router.delete("/{organization_id}/{form_id}")
async def delete_onboarding_form(
    organization_id: int,
    form_id: int,
    current_user = Depends(get_user_from_token)
):
    """Delete an onboarding form - only accessible by organization owner"""
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
            # Check if form has responses
            cur.execute("""
                SELECT COUNT(*) FROM onboarding_responses 
                WHERE form_id = %s
            """, (form_id,))
            
            response_count = cur.fetchone()[0]
            if response_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot delete form with {response_count} responses. Consider deactivating instead."
                )
            
            # Delete the form
            cur.execute("""
                DELETE FROM onboarding_forms 
                WHERE id = %s AND organization_id = %s
            """, (form_id, organization_id))
            
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Form not found"
                )
            
            conn.commit()
            
            return {"message": "Form deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting form: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/active")
async def get_active_forms_for_client(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get active onboarding forms for a client"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify user is a client of this organization
            cur.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (organization_id, current_user['user_id']))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this organization"
                )
            
            # Get active forms that client hasn't completed yet
            cur.execute("""
                SELECT f.id, f.organization_id, f.name, f.description, f.is_required,
                       f.form_fields, f.settings
                FROM onboarding_forms f
                WHERE f.organization_id = %s 
                  AND f.is_active = TRUE
                  AND f.id NOT IN (
                      SELECT form_id FROM onboarding_responses 
                      WHERE client_id = %s AND status = 'completed'
                  )
                ORDER BY f.is_required DESC, f.created_at ASC
            """, (organization_id, current_user['user_id']))
            
            forms = []
            for row in cur.fetchall():
                forms.append({
                    "id": row[0],
                    "organization_id": row[1],
                    "name": row[2],
                    "description": row[3],
                    "is_required": row[4],
                    "form_fields": row[5] or [],
                    "settings": row[6] or {}
                })
            
            return {"forms": forms}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching active forms: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch active forms"
        )
    finally:
        conn.close()

@router.post("/{organization_id}/{form_id}/submit")
async def submit_form_response(
    organization_id: int,
    form_id: int,
    response_data: Dict[str, Any],
    current_user = Depends(get_user_from_token)
):
    """Submit a response to an onboarding form"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify user is a client of this organization
            cur.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (organization_id, current_user['user_id']))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this organization"
                )
            
            # Verify form exists and is active
            cur.execute("""
                SELECT id FROM onboarding_forms 
                WHERE id = %s AND organization_id = %s AND is_active = TRUE
            """, (form_id, organization_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Form not found or inactive"
                )
            
            # Check if response already exists
            cur.execute("""
                SELECT id FROM onboarding_responses 
                WHERE form_id = %s AND client_id = %s
            """, (form_id, current_user['user_id']))
            
            existing_response = cur.fetchone()
            
            response_json = json.dumps(response_data)
            
            if existing_response:
                # Update existing response
                cur.execute("""
                    UPDATE onboarding_responses 
                    SET response_data = %s, completed_at = CURRENT_TIMESTAMP, status = 'completed'
                    WHERE form_id = %s AND client_id = %s
                    RETURNING id
                """, (response_json, form_id, current_user['user_id']))
                response_id = cur.fetchone()[0]
            else:
                # Create new response
                cur.execute("""
                    INSERT INTO onboarding_responses 
                    (form_id, client_id, organization_id, response_data, status)
                    VALUES (%s, %s, %s, %s, 'completed')
                    RETURNING id
                """, (form_id, current_user['user_id'], organization_id, response_json))
                response_id = cur.fetchone()[0]
            
            conn.commit()
            
            return {
                "message": "Response submitted successfully",
                "response_id": response_id
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting response: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit response"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/responses")
async def get_form_responses(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get all form responses for an organization"""
    # Verify user has access to organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get all responses for the organization
            cur.execute("""
                SELECT 
                    r.id,
                    r.form_id,
                    r.client_id,
                    r.organization_id,
                    r.response_data,
                    r.status,
                    r.completed_at,
                    r.reviewed_by,
                    r.reviewed_at,
                    r.notes,
                    f.name as form_name,
                    up.name as client_name
                FROM onboarding_responses r
                JOIN onboarding_forms f ON r.form_id = f.id
                LEFT JOIN user_profiles up ON r.client_id = up.id
                WHERE r.organization_id = %s
                ORDER BY r.completed_at DESC
            """, (organization_id,))
            
            responses = cur.fetchall()
            
            # Convert to list of dicts and handle JSON data
            result = []
            for response in responses:
                result.append({
                    "id": response[0],
                    "form_id": response[1],
                    "client_id": response[2],
                    "organization_id": response[3],
                    "response_data": json.loads(response[4]) if response[4] else {},
                    "status": response[5],
                    "completed_at": response[6],
                    "reviewed_by": response[7],
                    "reviewed_at": response[8],
                    "notes": response[9],
                    "form_name": response[10],
                    "client_name": response[11]
                })
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting form responses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get form responses"
        )
    finally:
        conn.close()

@router.put("/responses/{response_id}/notes")
async def update_response_notes(
    response_id: int,
    notes_data: dict,
    current_user = Depends(get_user_from_token)
):
    """Update notes for a form response"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify response exists and user has access
            cur.execute("""
                SELECT r.id, r.organization_id
                FROM onboarding_responses r
                JOIN organizations o ON r.organization_id = o.id
                WHERE r.id = %s AND o.owner_id = %s
            """, (response_id, current_user['user_id']))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Response not found or access denied"
                )
            
            # Update notes
            cur.execute("""
                UPDATE onboarding_responses 
                SET notes = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (notes_data.get('notes', ''), current_user['user_id'], response_id))
            
            conn.commit()
            
            return {"message": "Notes updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating response notes: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notes"
        )
    finally:
        conn.close()