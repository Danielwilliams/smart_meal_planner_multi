-- List all tables with their columns
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.column_default,
    c.is_nullable
FROM 
    information_schema.tables t
JOIN 
    information_schema.columns c 
    ON c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    t.table_name,
    c.ordinal_position;

-- Show migration tables specifically
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public'
    AND (table_name = 'alembic_version' 
         OR table_name LIKE '%migration%'
         OR table_name = 'completed_migrations');