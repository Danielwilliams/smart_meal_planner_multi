-- Query to replicate the smp_DB_Schema.csv format
WITH table_columns AS (
    SELECT 
        t.table_name,
        json_agg(
            json_build_object(
                'column_name', c.column_name,
                'data_type', c.data_type,
                'character_maximum_length', c.character_maximum_length,
                'column_default', c.column_default,
                'is_nullable', c.is_nullable
            ) ORDER BY c.ordinal_position
        ) as columns
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
),
primary_keys AS (
    SELECT 
        tc.table_name,
        json_agg(kcu.column_name ORDER BY kcu.ordinal_position) as primary_keys
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
    GROUP BY tc.table_name
),
foreign_keys AS (
    SELECT 
        tc.table_name,
        json_agg(
            json_build_object(
                'constraint_name', tc.constraint_name,
                'column_name', kcu.column_name,
                'foreign_table_schema', ccu.table_schema,
                'foreign_table_name', ccu.table_name,
                'foreign_column_name', ccu.column_name
            )
        ) as foreign_keys
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    GROUP BY tc.table_name
),
indexes AS (
    SELECT 
        tablename as table_name,
        json_agg(
            json_build_object(
                'indexname', indexname,
                'indexdef', indexdef
            )
        ) as indexes
    FROM pg_indexes
    WHERE schemaname = 'public'
    GROUP BY tablename
)
SELECT 
    tc.table_name,
    tc.columns,
    COALESCE(pk.primary_keys, '[]'::json) as primary_keys,
    COALESCE(fk.foreign_keys, '[]'::json) as foreign_keys,
    COALESCE(idx.indexes, '[]'::json) as indexes
FROM table_columns tc
LEFT JOIN primary_keys pk ON tc.table_name = pk.table_name
LEFT JOIN foreign_keys fk ON tc.table_name = fk.table_name
LEFT JOIN indexes idx ON tc.table_name = idx.table_name
ORDER BY tc.table_name;