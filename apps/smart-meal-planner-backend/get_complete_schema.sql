-- Complete PostgreSQL Database Schema Export
-- This query will return all tables, columns, indexes, views, functions, and relationships

-- 1. Get all tables and their columns with detailed information
SELECT 
    'TABLE_COLUMNS' as object_type,
    t.table_schema,
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    c.is_nullable,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.datetime_precision,
    c.udt_name,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE ''
    END as key_type
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT ku.table_name, ku.column_name, ku.table_schema
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name AND c.table_schema = pk.table_schema
WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog')
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_schema, t.table_name, c.ordinal_position

UNION ALL

-- 2. Get all foreign key constraints
SELECT 
    'FOREIGN_KEYS' as object_type,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    'FOREIGN KEY' as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    CONCAT('REFERENCES ', ccu.table_schema, '.', ccu.table_name, '(', ccu.column_name, ')') as udt_name,
    tc.constraint_name as key_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')

UNION ALL

-- 3. Get all views and their definitions
SELECT 
    'VIEWS' as object_type,
    table_schema,
    table_name,
    'VIEW_DEFINITION' as column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    'VIEW' as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    view_definition as udt_name,
    'VIEW' as key_type
FROM information_schema.views
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')

UNION ALL

-- 4. Get all indexes
SELECT 
    'INDEXES' as object_type,
    schemaname as table_schema,
    tablename as table_name,
    indexname as column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    'INDEX' as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    indexdef as udt_name,
    'INDEX' as key_type
FROM pg_indexes
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')

UNION ALL

-- 5. Get all functions and stored procedures
SELECT 
    'FUNCTIONS' as object_type,
    routine_schema as table_schema,
    routine_name as table_name,
    'FUNCTION_DEFINITION' as column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    routine_type as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    routine_definition as udt_name,
    'FUNCTION' as key_type
FROM information_schema.routines
WHERE routine_schema NOT IN ('information_schema', 'pg_catalog')

UNION ALL

-- 6. Get all check constraints
SELECT 
    'CHECK_CONSTRAINTS' as object_type,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name as column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    'CHECK' as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    cc.check_clause as udt_name,
    'CHECK' as key_type
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')

UNION ALL

-- 7. Get all unique constraints
SELECT 
    'UNIQUE_CONSTRAINTS' as object_type,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    NULL as ordinal_position,
    NULL as column_default,
    NULL as is_nullable,
    'UNIQUE' as data_type,
    NULL as character_maximum_length,
    NULL as numeric_precision,
    NULL as numeric_scale,
    NULL as datetime_precision,
    tc.constraint_name as udt_name,
    'UNIQUE' as key_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')

ORDER BY object_type, table_schema, table_name, ordinal_position;