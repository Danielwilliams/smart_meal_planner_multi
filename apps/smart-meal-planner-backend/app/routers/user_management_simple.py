from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {"message": "User management API is working!"}

@router.get("/permissions")
async def get_permissions():
    """Simple permissions endpoint for testing"""
    return {
        "can_pause_users": True,
        "can_delete_users": True,
        "can_restore_users": True,
        "can_view_all_users": True,
        "can_manage_org_users": True,
        "is_system_admin": True
    }

@router.get("/debug")
async def debug_endpoint():
    """Debug endpoint to verify routing"""
    return {
        "message": "User management debug endpoint working",
        "timestamp": "2025-06-13T18:15:00Z",
        "status": "ok"
    }