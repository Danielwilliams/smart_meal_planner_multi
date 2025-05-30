#!/usr/bin/env python3
"""
Simplified debug script to check shared menus
"""
import sys
sys.path.insert(0, '/mnt/c/Users/danie/OneDrive/Documents/smart_meal_planner_multi/apps/smart-meal-planner-backend')

from app.db import get_db_connection
from psycopg2.extras import RealDictCursor

def debug_client_26():
    """Debug why client 26 isn't seeing menus"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("\n=== DEBUGGING CLIENT 26 MENUS ===\n")
    
    # 1. Check client info
    print("1. CLIENT INFO:")
    cursor.execute("""
        SELECT id, email, role, organization_id
        FROM users
        WHERE id = 26
    """)
    client_info = cursor.fetchone()
    print(f"Client 26: {client_info}")
    
    # 2. Check shared menus for client 26
    print("\n2. SHARED MENUS FOR CLIENT 26:")
    cursor.execute("""
        SELECT sm.*, m.title, m.nickname, m.organization_id as menu_org_id
        FROM shared_menus sm
        LEFT JOIN menus m ON sm.menu_id = m.id
        WHERE sm.client_id = 26
        ORDER BY sm.shared_at DESC
    """)
    shared_menus = cursor.fetchall()
    print(f"Found {len(shared_menus)} shared menus")
    for menu in shared_menus[:3]:  # Show first 3
        print(f"  - Menu ID: {menu['menu_id']}, Title: {menu['title']}, Org: {menu['organization_id']}, Menu Org: {menu['menu_org_id']}")
    
    # 3. Check organization relationships
    print("\n3. ORGANIZATION RELATIONSHIPS:")
    cursor.execute("""
        SELECT * FROM organization_clients
        WHERE client_id = 26
    """)
    org_relationships = cursor.fetchall()
    print(f"Found {len(org_relationships)} organization relationships")
    for rel in org_relationships:
        print(f"  - Org ID: {rel.get('organization_id')}, Status: {rel.get('status')}")
    
    # 4. Check the organization owner (user 29)
    print("\n4. ORGANIZATION OWNER INFO:")
    cursor.execute("""
        SELECT id, email, role, organization_id
        FROM users
        WHERE id = 29
    """)
    owner_info = cursor.fetchone()
    print(f"User 29: {owner_info}")
    
    # 5. Check organizations owned by user 29
    print("\n5. ORGANIZATIONS OWNED BY USER 29:")
    cursor.execute("""
        SELECT * FROM organizations
        WHERE owner_id = 29
    """)
    orgs = cursor.fetchall()
    for org in orgs:
        print(f"  - Org ID: {org['id']}, Name: {org['name']}")
    
    # 6. Test the queries that the endpoints use
    print("\n6. TESTING ENDPOINT QUERIES:")
    
    # Test client dashboard query
    print("\n6a. Client Dashboard Query (client_id=26):")
    cursor.execute("""
        SELECT 
            sm.id as share_id, 
            sm.menu_id, 
            sm.client_id, 
            sm.organization_id, 
            sm.permission_level,
            sm.shared_at,
            sm.message,
            m.title, 
            m.nickname,
            m.description,
            m.created_at,
            o.name as organization_name
        FROM shared_menus sm
        JOIN menus m ON sm.menu_id = m.id
        LEFT JOIN organizations o ON sm.organization_id = o.id
        WHERE sm.client_id = 26 AND sm.is_active = TRUE
        ORDER BY sm.shared_at DESC
    """)
    dashboard_menus = cursor.fetchall()
    print(f"Dashboard query found {len(dashboard_menus)} menus")
    
    # Test organization view query
    print("\n6b. Organization View Query (client_id=26, org_id=7):")
    cursor.execute("""
        SELECT 
            m.id,
            m.title,
            m.description,
            m.created_at,
            m.nickname,
            m.published,
            m.image_url,
            ms.permission_level,
            ms.shared_at,
            ms.id as share_id,
            ms.message
        FROM menus m
        JOIN shared_menus ms ON m.id = ms.menu_id
        WHERE ms.client_id = 26 AND ms.organization_id = 7 AND ms.is_active = TRUE
        ORDER BY ms.shared_at DESC
    """)
    org_menus = cursor.fetchall()
    print(f"Organization view query found {len(org_menus)} menus")
    
    # 7. Check for any issues with the data
    print("\n7. DATA CONSISTENCY CHECKS:")
    
    # Check if all menu_ids in shared_menus exist in menus table
    cursor.execute("""
        SELECT sm.menu_id
        FROM shared_menus sm
        LEFT JOIN menus m ON sm.menu_id = m.id
        WHERE sm.client_id = 26 AND m.id IS NULL
    """)
    missing_menus = cursor.fetchall()
    if missing_menus:
        print(f"WARNING: {len(missing_menus)} shared menu records reference non-existent menus!")
    else:
        print("✓ All shared menu records have valid menu references")
    
    # Check organization consistency
    cursor.execute("""
        SELECT DISTINCT sm.organization_id, oc.organization_id as oc_org_id
        FROM shared_menus sm
        LEFT JOIN organization_clients oc ON sm.client_id = oc.client_id AND sm.organization_id = oc.organization_id
        WHERE sm.client_id = 26
    """)
    org_consistency = cursor.fetchall()
    print(f"Organization IDs in shared_menus: {[r['organization_id'] for r in org_consistency]}")
    print(f"Organization IDs in org_clients: {[r['oc_org_id'] for r in org_consistency if r['oc_org_id']]}")
    
    # 8. Check if organization_clients table is populated correctly
    print("\n8. ORGANIZATION_CLIENTS TABLE CHECK:")
    cursor.execute("""
        SELECT COUNT(*) as count FROM organization_clients
    """)
    total_oc = cursor.fetchone()
    print(f"Total organization_clients records: {total_oc['count']}")
    
    cursor.execute("""
        SELECT * FROM organization_clients
        WHERE client_id = 26 OR organization_id = 7
        LIMIT 10
    """)
    oc_records = cursor.fetchall()
    print(f"Organization_clients records for client 26 or org 7:")
    for rec in oc_records:
        print(f"  - Client: {rec.get('client_id')}, Org: {rec.get('organization_id')}, Status: {rec.get('status')}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    debug_client_26()