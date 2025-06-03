-- Complete schema extraction query for pgAdmin
WITH table_list AS (
    SELECT 
        table_schema, 
        table_name
    FROM 
        information_schema.tables
    WHERE 
        table_schema = 'public'
        AND table_type = 'BASE TABLE'
    ORDER BY 
        table_name
),
columns AS (
    SELECT 
        t.table_schema,
        t.table_name,
        json_agg(
            json_build_object(
                'column_name', c.column_name,
                'data_type', c.data_type,
                'character_maximum_length', c.character_maximum_length,
                'column_default', c.column_default,
                'is_nullable', c.is_nullable
            ) ORDER BY c.ordinal_position
        ) AS columns
    FROM 
        table_list t
    JOIN 
        information_schema.columns c 
        ON c.table_schema = t.table_schema 
        AND c.table_name = t.table_name
    GROUP BY 
        t.table_schema, t.table_name
),
primary_keys AS (
    SELECT 
        t.table_schema,
        t.table_name,
        json_agg(kcu.column_name) AS primary_keys
    FROM 
        table_list t
    JOIN 
        information_schema.table_constraints tc 
        ON tc.table_schema = t.table_schema 
        AND tc.table_name = t.table_name 
        AND tc.constraint_type = 'PRIMARY KEY'
    JOIN 
        information_schema.key_column_usage kcu 
        ON kcu.constraint_name = tc.constraint_name 
        AND kcu.constraint_schema = tc.constraint_schema
    GROUP BY 
        t.table_schema, t.table_name
),
foreign_keys AS (
    SELECT 
        t.table_schema,
        t.table_name,
        json_agg(
            json_build_object(
                'constraint_name', tc.constraint_name,
                'column_name', kcu.column_name,
                'foreign_table_schema', ccu.table_schema,
                'foreign_table_name', ccu.table_name,
                'foreign_column_name', ccu.column_name
            )
        ) AS foreign_keys
    FROM 
        table_list t
    JOIN 
        information_schema.table_constraints tc 
        ON tc.table_schema = t.table_schema 
        AND tc.table_name = t.table_name 
        AND tc.constraint_type = 'FOREIGN KEY'
    JOIN 
        information_schema.key_column_usage kcu 
        ON kcu.constraint_name = tc.constraint_name 
        AND kcu.constraint_schema = tc.constraint_schema
    JOIN 
        information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name 
        AND ccu.constraint_schema = tc.constraint_schema
    GROUP BY 
        t.table_schema, t.table_name
),
indexes AS (
    SELECT 
        t.table_schema,
        t.table_name,
        json_agg(
            json_build_object(
                'indexname', i.indexname,
                'indexdef', i.indexdef
            )
        ) AS indexes
    FROM 
        table_list t
    JOIN 
        pg_catalog.pg_indexes i 
        ON i.schemaname = t.table_schema 
        AND i.tablename = t.table_name
    GROUP BY 
        t.table_schema, t.table_name
),
migrations AS (
    SELECT
        table_name,
        column_name,
        data_type
    FROM
        information_schema.columns
    WHERE
        table_name = 'alembic_version'
        OR table_name LIKE '%migration%'
)
SELECT 
    t.table_name,
    COALESCE(c.columns, '[]'::json) AS columns,
    COALESCE(pk.primary_keys, '[]'::json) AS primary_keys,
    COALESCE(fk.foreign_keys, '[]'::json) AS foreign_keys,
    COALESCE(i.indexes, '[]'::json) AS indexes
FROM 
    table_list t
LEFT JOIN 
    columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
LEFT JOIN 
    primary_keys pk ON pk.table_schema = t.table_schema AND pk.table_name = t.table_name
LEFT JOIN 
    foreign_keys fk ON fk.table_schema = t.table_schema AND fk.table_name = t.table_name
LEFT JOIN 
    indexes i ON i.table_schema = t.table_schema AND i.table_name = t.table_name
ORDER BY 
    t.table_name;

-- Also show migration tracking tables separately
SELECT * FROM migrations;