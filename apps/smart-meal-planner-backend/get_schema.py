"""
Script to get a complete database schema dump for all tables
"""
import psycopg2
import psycopg2.extras
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database connection parameters
db_params = {
    'dbname': os.getenv('DATABASE_NAME'),
    'user': os.getenv('DATABASE_USER'),
    'password': os.getenv('DATABASE_PASSWORD'),
    'host': os.getenv('DATABASE_HOST'),
    'port': os.getenv('DATABASE_PORT', '5432')
}

def get_db_schema():
    """Get complete schema information for all tables in the database"""
    
    connection = None
    try:
        # Connect to the database
        connection = psycopg2.connect(**db_params)
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Query to get all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        
        schema = {}
        
        # For each table, get its columns and constraints
        for table_row in tables:
            table_name = table_row[0]
            
            # Get columns
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length, 
                       column_default, is_nullable
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            columns = cursor.fetchall()
            
            # Get primary key
            cursor.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = %s::regclass AND i.indisprimary;
            """, (table_name,))
            primary_keys = [pk[0] for pk in cursor.fetchall()]
            
            # Get foreign keys
            cursor.execute("""
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM
                    information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
            """, (table_name,))
            foreign_keys = cursor.fetchall()
            
            # Get indexes
            cursor.execute("""
                SELECT
                    indexname,
                    indexdef
                FROM
                    pg_indexes
                WHERE
                    tablename = %s;
            """, (table_name,))
            indexes = cursor.fetchall()
            
            # Store all information for this table
            schema[table_name] = {
                'columns': [dict(col) for col in columns],
                'primary_keys': primary_keys,
                'foreign_keys': [dict(fk) for fk in foreign_keys],
                'indexes': [dict(idx) for idx in indexes]
            }
        
        return schema
        
    except Exception as e:
        print(f"Error: {e}")
        return None
        
    finally:
        if connection:
            connection.close()

if __name__ == "__main__":
    schema = get_db_schema()
    if schema:
        # Write schema to a file
        with open('current_db_schema.json', 'w') as f:
            json.dump(schema, f, indent=2, default=str)
        print(f"Schema written to current_db_schema.json")
        
        # Print summary
        print("\nDatabase Schema Summary:")
        print(f"Total tables: {len(schema)}")
        for table_name, table_info in schema.items():
            print(f"  - {table_name}: {len(table_info['columns'])} columns")