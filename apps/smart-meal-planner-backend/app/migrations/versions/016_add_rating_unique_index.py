"""
Migration: Add unique partial index for recipe ratings upsert
ID: 016_add_rating_unique_index
Description: Adds a partial unique index on recipe_interactions(user_id, recipe_id)
             WHERE interaction_type = 'rating' to enable atomic upsert and prevent
             duplicate rating rows.
"""

import os
import sys
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.db import get_db_connection

logger = logging.getLogger(__name__)


def upgrade():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_interactions_user_recipe_rating
                ON recipe_interactions(user_id, recipe_id)
                WHERE interaction_type = 'rating'
            """)
        conn.commit()
        logger.info("Created partial unique index idx_recipe_interactions_user_recipe_rating")
    except Exception as e:
        conn.rollback()
        logger.error(f"Migration 016 failed: {e}")
        raise
    finally:
        conn.close()


def downgrade():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DROP INDEX IF EXISTS idx_recipe_interactions_user_recipe_rating")
        conn.commit()
        logger.info("Dropped index idx_recipe_interactions_user_recipe_rating")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    upgrade()
