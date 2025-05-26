# app/routers/client_notes.py
from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.db import get_db_connection
from app.models.user import (
    ClientNote, ClientNoteCreate, ClientNoteUpdate,
    ClientNoteTemplate, ClientNoteTemplateCreate
)
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/client-notes", tags=["client-notes"])
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

def verify_client_access(organization_id: int, client_id: int):
    """Verify that the organization has access to the specified client"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s
            """, (organization_id, client_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Client not found or not associated with this organization"
                )
    finally:
        conn.close()

@router.get("/{organization_id}/clients/{client_id}")
async def get_client_notes(
    organization_id: int,
    client_id: int,
    current_user = Depends(get_user_from_token),
    note_type: Optional[str] = Query(None, description="Filter by note type"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    include_archived: bool = Query(False, description="Include archived notes")
):
    """Get all notes for a specific client"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    # Verify organization has access to client
    verify_client_access(organization_id, client_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build query with filters
            where_conditions = [
                "cn.organization_id = %s",
                "cn.client_id = %s"
            ]
            params = [organization_id, client_id]
            
            if not include_archived:
                where_conditions.append("cn.is_archived = FALSE")
            
            if note_type:
                where_conditions.append("cn.note_type = %s")
                params.append(note_type)
            
            if priority:
                where_conditions.append("cn.priority = %s")
                params.append(priority)
            
            if tags:
                tag_list = [tag.strip() for tag in tags.split(',')]
                where_conditions.append("cn.tags ?| %s")
                params.append(tag_list)
            
            query = f"""
                SELECT 
                    cn.id,
                    cn.organization_id,
                    cn.client_id,
                    cn.title,
                    cn.content,
                    cn.note_type,
                    cn.priority,
                    cn.is_private,
                    cn.is_archived,
                    cn.tags,
                    cn.created_at,
                    cn.updated_at,
                    cn.created_by,
                    cn.updated_by,
                    up_client.name as client_name,
                    up_creator.name as created_by_name,
                    up_updater.name as updated_by_name
                FROM client_notes cn
                LEFT JOIN user_profiles up_client ON cn.client_id = up_client.id
                LEFT JOIN user_profiles up_creator ON cn.created_by = up_creator.id
                LEFT JOIN user_profiles up_updater ON cn.updated_by = up_updater.id
                WHERE {' AND '.join(where_conditions)}
                ORDER BY cn.created_at DESC
            """
            
            cur.execute(query, params)
            notes = cur.fetchall()
            
            # Convert to list of dicts and handle JSON data
            result = []
            for note in notes:
                result.append({
                    "id": note[0],
                    "organization_id": note[1],
                    "client_id": note[2],
                    "title": note[3],
                    "content": note[4],
                    "note_type": note[5],
                    "priority": note[6],
                    "is_private": note[7],
                    "is_archived": note[8],
                    "tags": json.loads(note[9]) if note[9] else [],
                    "created_at": note[10],
                    "updated_at": note[11],
                    "created_by": note[12],
                    "updated_by": note[13],
                    "client_name": note[14],
                    "created_by_name": note[15],
                    "updated_by_name": note[16]
                })
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client notes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get client notes"
        )
    finally:
        conn.close()

@router.post("/{organization_id}")
async def create_client_note(
    organization_id: int,
    note_data: ClientNoteCreate,
    current_user = Depends(get_user_from_token)
):
    """Create a new client note"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    # Verify organization has access to client
    verify_client_access(organization_id, note_data.client_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO client_notes 
                (organization_id, client_id, title, content, note_type, priority, 
                 is_private, tags, created_by, updated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at, updated_at
            """, (
                organization_id,
                note_data.client_id,
                note_data.title,
                note_data.content,
                note_data.note_type,
                note_data.priority,
                note_data.is_private,
                json.dumps(note_data.tags),
                current_user['user_id'],
                current_user['user_id']
            ))
            
            result = cur.fetchone()
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": organization_id,
                "client_id": note_data.client_id,
                "title": note_data.title,
                "content": note_data.content,
                "note_type": note_data.note_type,
                "priority": note_data.priority,
                "is_private": note_data.is_private,
                "is_archived": False,
                "tags": note_data.tags,
                "created_at": result[1],
                "updated_at": result[2],
                "created_by": current_user['user_id'],
                "updated_by": current_user['user_id']
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating client note: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create client note"
        )
    finally:
        conn.close()

@router.put("/{organization_id}/notes/{note_id}")
async def update_client_note(
    organization_id: int,
    note_id: int,
    note_data: ClientNoteUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update a client note"""
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
            # Verify note exists and belongs to organization
            cur.execute("""
                SELECT id FROM client_notes 
                WHERE id = %s AND organization_id = %s
            """, (note_id, organization_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Note not found"
                )
            
            # Build update query dynamically
            update_fields = []
            params = []
            
            if note_data.title is not None:
                update_fields.append("title = %s")
                params.append(note_data.title)
            
            if note_data.content is not None:
                update_fields.append("content = %s")
                params.append(note_data.content)
            
            if note_data.note_type is not None:
                update_fields.append("note_type = %s")
                params.append(note_data.note_type)
            
            if note_data.priority is not None:
                update_fields.append("priority = %s")
                params.append(note_data.priority)
            
            if note_data.is_private is not None:
                update_fields.append("is_private = %s")
                params.append(note_data.is_private)
            
            if note_data.tags is not None:
                update_fields.append("tags = %s")
                params.append(json.dumps(note_data.tags))
            
            if note_data.is_archived is not None:
                update_fields.append("is_archived = %s")
                params.append(note_data.is_archived)
            
            if not update_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            # Add updated_by
            update_fields.append("updated_by = %s")
            params.append(current_user['user_id'])
            
            # Add WHERE clause parameters
            params.extend([note_id])
            
            query = f"""
                UPDATE client_notes 
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id, organization_id, client_id, title, content, note_type, 
                          priority, is_private, is_archived, tags, created_at, updated_at, 
                          created_by, updated_by
            """
            
            cur.execute(query, params)
            result = cur.fetchone()
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "client_id": result[2],
                "title": result[3],
                "content": result[4],
                "note_type": result[5],
                "priority": result[6],
                "is_private": result[7],
                "is_archived": result[8],
                "tags": json.loads(result[9]) if result[9] else [],
                "created_at": result[10],
                "updated_at": result[11],
                "created_by": result[12],
                "updated_by": result[13]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating client note: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client note"
        )
    finally:
        conn.close()

@router.delete("/{organization_id}/notes/{note_id}")
async def delete_client_note(
    organization_id: int,
    note_id: int,
    current_user = Depends(get_user_from_token)
):
    """Delete a client note"""
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
                DELETE FROM client_notes 
                WHERE id = %s AND organization_id = %s
            """, (note_id, organization_id))
            
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Note not found"
                )
            
            conn.commit()
            return {"message": "Note deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting client note: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete client note"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/templates")
async def get_note_templates(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get all note templates for an organization"""
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
                SELECT 
                    id, organization_id, name, template_content, note_type,
                    suggested_tags, is_active, usage_count, created_at, updated_at, created_by
                FROM client_note_templates
                WHERE organization_id = %s AND is_active = TRUE
                ORDER BY usage_count DESC, name ASC
            """, (organization_id,))
            
            templates = cur.fetchall()
            
            result = []
            for template in templates:
                result.append({
                    "id": template[0],
                    "organization_id": template[1],
                    "name": template[2],
                    "template_content": template[3],
                    "note_type": template[4],
                    "suggested_tags": json.loads(template[5]) if template[5] else [],
                    "is_active": template[6],
                    "usage_count": template[7],
                    "created_at": template[8],
                    "updated_at": template[9],
                    "created_by": template[10]
                })
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting note templates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get note templates"
        )
    finally:
        conn.close()

@router.post("/{organization_id}/templates")
async def create_note_template(
    organization_id: int,
    template_data: ClientNoteTemplateCreate,
    current_user = Depends(get_user_from_token)
):
    """Create a new note template"""
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
                INSERT INTO client_note_templates 
                (organization_id, name, template_content, note_type, suggested_tags, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, created_at, updated_at
            """, (
                organization_id,
                template_data.name,
                template_data.template_content,
                template_data.note_type,
                json.dumps(template_data.suggested_tags),
                current_user['user_id']
            ))
            
            result = cur.fetchone()
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": organization_id,
                "name": template_data.name,
                "template_content": template_data.template_content,
                "note_type": template_data.note_type,
                "suggested_tags": template_data.suggested_tags,
                "is_active": True,
                "usage_count": 0,
                "created_at": result[1],
                "updated_at": result[2],
                "created_by": current_user['user_id']
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating note template: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create note template"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/overview")
async def get_notes_overview(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get notes overview and statistics for the organization"""
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
            # Get notes statistics
            cur.execute("""
                SELECT 
                    COUNT(*) as total_notes,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_notes,
                    COUNT(*) FILTER (WHERE priority = 'high') as high_priority_notes,
                    COUNT(*) FILTER (WHERE note_type = 'consultation') as consultation_notes,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_notes,
                    COUNT(DISTINCT client_id) as clients_with_notes
                FROM client_notes
                WHERE organization_id = %s AND is_archived = FALSE
            """, (organization_id,))
            
            stats = cur.fetchone()
            
            # Get recent notes
            cur.execute("""
                SELECT 
                    cn.id, cn.client_id, cn.title, cn.note_type, cn.priority, 
                    cn.created_at, up.name as client_name
                FROM client_notes cn
                LEFT JOIN user_profiles up ON cn.client_id = up.id
                WHERE cn.organization_id = %s AND cn.is_archived = FALSE
                ORDER BY cn.created_at DESC
                LIMIT 10
            """, (organization_id,))
            
            recent_notes = cur.fetchall()
            
            return {
                "statistics": {
                    "total_notes": stats[0] or 0,
                    "urgent_notes": stats[1] or 0,
                    "high_priority_notes": stats[2] or 0,
                    "consultation_notes": stats[3] or 0,
                    "recent_notes": stats[4] or 0,
                    "clients_with_notes": stats[5] or 0
                },
                "recent_notes": [
                    {
                        "id": note[0],
                        "client_id": note[1],
                        "title": note[2] or "Untitled Note",
                        "note_type": note[3],
                        "priority": note[4],
                        "created_at": note[5],
                        "client_name": note[6]
                    }
                    for note in recent_notes
                ]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting notes overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notes overview"
        )
    finally:
        conn.close()