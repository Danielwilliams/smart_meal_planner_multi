"""
Migration: Widen subscriptions.payment_provider CHECK constraint
ID: 018_fix_subscriptions_payment_provider_check
Description: The original constraint only permitted ('stripe', 'paypal'), which
             blocks signup because migrate_to_free_tier() inserts a free-tier
             row with payment_provider='none'. This migration drops any CHECK
             constraint on payment_provider and re-adds one accepting
             'stripe', 'paypal', and 'none'. Idempotent.
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
                    WHERE n.nspname = 'public' AND c.relname = 'subscriptions'
                )
            """)
            if not cur.fetchone()[0]:
                logger.info("subscriptions table does not exist; nothing to do")
                return

            # Find every CHECK constraint on the payment_provider column via pg_catalog.
            cur.execute("""
                SELECT con.conname
                FROM pg_catalog.pg_constraint con
                JOIN pg_catalog.pg_class cls
                  ON cls.oid = con.conrelid
                JOIN pg_catalog.pg_namespace nsp
                  ON nsp.oid = cls.relnamespace
                JOIN pg_catalog.pg_attribute att
                  ON att.attrelid = cls.oid
                 AND att.attnum = ANY(con.conkey)
                WHERE nsp.nspname = 'public'
                  AND cls.relname = 'subscriptions'
                  AND con.contype = 'c'
                  AND att.attname = 'payment_provider'
            """)
            existing = [r[0] for r in cur.fetchall()]

            for name in existing:
                logger.info("Dropping payment_provider CHECK constraint: %s", name)
                cur.execute(
                    f'ALTER TABLE subscriptions DROP CONSTRAINT "{name}"'
                )

            logger.info(
                "Adding subscriptions_payment_provider_check allowing 'stripe', 'paypal', 'none'"
            )
            cur.execute("""
                ALTER TABLE subscriptions
                ADD CONSTRAINT subscriptions_payment_provider_check
                CHECK (payment_provider IN ('stripe', 'paypal', 'none'))
            """)

        conn.commit()
        logger.info("Migration 018 completed")
    except Exception as e:
        conn.rollback()
        logger.error(f"Migration 018 failed: {e}")
        raise
    finally:
        conn.close()


def downgrade():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_payment_provider_check'
            )
            cur.execute("""
                ALTER TABLE subscriptions
                ADD CONSTRAINT subscriptions_payment_provider_check
                CHECK (payment_provider IN ('stripe', 'paypal'))
            """)
        conn.commit()
        logger.info("Migration 018 downgraded")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    upgrade()
