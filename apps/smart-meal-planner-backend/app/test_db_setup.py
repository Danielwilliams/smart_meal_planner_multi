# app/test_db_setup.py
from create_recipe_tables import create_tables

if __name__ == "__main__":
    print("Testing database setup for multi-user app...")
    create_tables()
    print("Database setup test completed successfully!")