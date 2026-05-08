"""
Migration: Repoint user_management_logs FKs to user_profiles
ID: 017_fix_user_management_logs_fk
Description: Some installs created user_management_logs with FK references to
             the vestigial `users` table. Real users live in user_profiles, so
             audit-log inserts for admin pause/delete actions fail with a FK
             violation. This migration drops any FK on user_id / performed_by
             that points at `users` and recreates it against user_profiles(id).
             Idempotent: skips columns whose FK already points to user_profiles.
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
                SELECT EXISTS (
                    SELECT FROM pg_catalog.pg_class c
                    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'user_management_logs'
                )
            """)
            if not cur.fetchone()[0]:
                logger.info("user_management_logs table does not exist; nothing to do")
                return

            for fk_column in ('user_id', 'performed_by'):
                # Look up any existing FK on this column via pg_catalog (reliable for FKs).
                cur.execute("""
                    SELECT con.conname,
                           ref_cls.relname
                    FROM pg_catalog.pg_constraint con
                    JOIN pg_catalog.pg_class cls
                      ON cls.oid = con.conrelid
                    JOIN pg_catalog.pg_namespace nsp
                      ON nsp.oid = cls.relnamespace
                    JOIN pg_catalog.pg_attribute att
                      ON att.attrelid = cls.oid
                     AND att.attnum = ANY(con.conkey)
                    JOIN pg_catalog.pg_class ref_cls
                      ON ref_cls.oid = con.confrelid
                    WHERE nsp.nspname = 'public'
                      AND cls.relname = 'user_management_logs'
                      AND con.contype = 'f'
                      AND att.attname = %s
                """, (fk_column,))
                row = cur.fetchone()

                if not row:
                    logger.info(
                        "No FK on user_management_logs.%s; adding one pointing to user_profiles",
                        fk_column,
                    )
                    cur.execute(f"""
                        ALTER TABLE user_management_logs
                        ADD CONSTRAINT user_management_logs_{fk_column}_fkey
                        FOREIGN KEY ({fk_column}) REFERENCES user_profiles(id)
                    """)
                    continue

                constraint_name, referenced_table = row
                if referenced_table == 'user_profiles':
                    logger.info(
                        "user_management_logs.%s FK already points to user_profiles; skipping",
                        fk_column,
                    )
                    continue

                logger.info(
                    "Repointing user_management_logs.%s FK (%s) from %s to user_profiles",
                    fk_column, constraint_name, referenced_table,
                )
                cur.execute(
                    f'ALTER TABLE user_management_logs DROP CONSTRAINT "{constraint_name}"'
                )
                cur.execute(f"""
                    ALTER TABLE user_management_logs
                    ADD CONSTRAINT user_management_logs_{fk_column}_fkey
                    FOREIGN KEY ({fk_column}) REFERENCES user_profiles(id)
                """)

        conn.commit()
        logger.info("Migration 017 completed: user_management_logs FKs point to user_profiles")
    except Exception as e:
        conn.rollback()
        logger.error(f"Migration 017 failed: {e}")
        raise
    finally:
        conn.close()


def downgrade():
    # No-op: re-pointing back to the vestigial `users` table would re-introduce the bug.
    logger.info("Migration 017 downgrade is a no-op")


if __name__ == "__main__":
    upgrade()
