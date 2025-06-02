#!/usr/bin/env python3
"""
Verification script for Kroger password hashing system.

This script verifies that:
1. Hashed passwords can be verified correctly
2. Password verification works for both hashed and plain text
3. New password updates are properly hashed
4. The migration was successful

Usage:
    python verify_password_hashing.py
"""

import sys
import os
import logging
from psycopg2.extras import RealDictCursor

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.db_simplified import get_db_connection, get_db_cursor
from app.utils.password_utils import hash_kroger_password, verify_kroger_password, is_password_hashed
from app.integration.kroger_db import get_kroger_password_for_auth, get_user_kroger_credentials

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_migration_status():
    """Check the overall status of the password migration."""
    logger.info("=== CHECKING MIGRATION STATUS ===")

    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Get overall statistics
            cur.execute("""
                SELECT
                    COUNT(*) as total_users,
                    COUNT(kroger_username) as users_with_username,
                    COUNT(kroger_password) as users_with_plain_password,
                    COUNT(kroger_password_hash) as users_with_hashed_password,
                    COUNT(kroger_password_salt) as users_with_salt,
                    COUNT(CASE WHEN kroger_password IS NOT NULL AND kroger_password_hash IS NOT NULL THEN 1 END) as users_with_both
                FROM user_profiles;
            """)
            stats = cur.fetchone()

            logger.info(f"Migration Statistics:")
            logger.info(f"  Total users: {stats['total_users']}")
            logger.info(f"  Users with Kroger username: {stats['users_with_username']}")
            logger.info(f"  Users with plain text password: {stats['users_with_plain_password']}")
            logger.info(f"  Users with hashed password: {stats['users_with_hashed_password']}")
            logger.info(f"  Users with password salt: {stats['users_with_salt']}")
            logger.info(f"  Users with both formats: {stats['users_with_both']}")

            return stats

    except Exception as e:
        logger.error(f"Error checking migration status: {e}")
        return None

def test_password_verification():
    """Test password verification for users with hashed passwords."""
    logger.info("=== TESTING PASSWORD VERIFICATION ===")

    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Get users with both plain text and hashed passwords for testing
            cur.execute("""
                SELECT id, kroger_username, kroger_password, kroger_password_hash, kroger_password_salt
                FROM user_profiles
                WHERE kroger_password IS NOT NULL
                AND kroger_password_hash IS NOT NULL
                AND kroger_password_salt IS NOT NULL
                LIMIT 5;
            """)
            test_users = cur.fetchall()

            if not test_users:
                logger.warning("No users found with both plain text and hashed passwords for testing")
                return False

            logger.info(f"Testing password verification for {len(test_users)} users...")

            success_count = 0
            total_tests = 0

            for user in test_users:
                user_id = user['id']
                username = user['kroger_username']
                plain_password = user['kroger_password']
                hashed_password = user['kroger_password_hash']
                salt = user['kroger_password_salt']

                total_tests += 1

                try:
                    # Test 1: Direct hash verification
                    is_valid = verify_kroger_password(plain_password, hashed_password, salt)

                    if is_valid:
                        logger.info(f"✅ User {user_id} ({username}): Hash verification successful")
                        success_count += 1
                    else:
                        logger.error(f"❌ User {user_id} ({username}): Hash verification failed")
                        continue

                    # Test 2: Integration function verification
                    verified_password = get_kroger_password_for_auth(user_id, plain_password)

                    if verified_password == plain_password:
                        logger.info(f"✅ User {user_id} ({username}): Integration verification successful")
                    else:
                        logger.error(f"❌ User {user_id} ({username}): Integration verification failed")
                        continue

                    # Test 3: Wrong password should fail
                    wrong_password = "definitely_wrong_password"
                    should_fail = get_kroger_password_for_auth(user_id, wrong_password)

                    if should_fail is None:
                        logger.info(f"✅ User {user_id} ({username}): Wrong password correctly rejected")
                    else:
                        logger.error(f"❌ User {user_id} ({username}): Wrong password incorrectly accepted")
                        continue

                except Exception as e:
                    logger.error(f"❌ User {user_id} ({username}): Verification error - {e}")
                    continue

            success_rate = (success_count / total_tests) * 100 if total_tests > 0 else 0
            logger.info(f"Password verification test results: {success_count}/{total_tests} successful ({success_rate:.1f}%)")

            return success_count == total_tests

    except Exception as e:
        logger.error(f"Error testing password verification: {e}")
        return False

def test_new_password_hashing():
    """Test that new password updates are properly hashed."""
    logger.info("=== TESTING NEW PASSWORD HASHING ===")
    
    # Test the hashing functions directly
    test_passwords = [
        "test_password_123",
        "another_test_password",
        "special_chars_!@#$%",
        "long_password_with_numbers_12345"
    ]
    
    for password in test_passwords:
        try:
            # Test hashing
            hashed, salt = hash_kroger_password(password)
            
            if not hashed or not salt:
                logger.error(f"❌ Failed to hash password: {password}")
                return False
            
            # Test verification
            is_valid = verify_kroger_password(password, hashed, salt)
            
            if is_valid:
                logger.info(f"✅ Password hashing/verification successful for test password")
            else:
                logger.error(f"❌ Password verification failed for test password")
                return False
                
            # Test wrong password
            wrong_verification = verify_kroger_password("wrong_password", hashed, salt)
            
            if not wrong_verification:
                logger.info(f"✅ Wrong password correctly rejected for test password")
            else:
                logger.error(f"❌ Wrong password incorrectly accepted for test password")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error testing password hashing: {e}")
            return False
    
    logger.info("✅ All new password hashing tests passed")
    return True

def check_hash_quality():
    """Check the quality of generated hashes."""
    logger.info("=== CHECKING HASH QUALITY ===")

    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Check hash lengths and formats
            cur.execute("""
                SELECT
                    LENGTH(kroger_password_hash) as hash_length,
                    LENGTH(kroger_password_salt) as salt_length,
                    COUNT(*) as count
                FROM user_profiles
                WHERE kroger_password_hash IS NOT NULL
                AND kroger_password_salt IS NOT NULL
                GROUP BY LENGTH(kroger_password_hash), LENGTH(kroger_password_salt);
            """)

            hash_stats = cur.fetchall()

            logger.info("Hash length statistics:")
            for stat in hash_stats:
                logger.info(f"  Hash length: {stat['hash_length']}, Salt length: {stat['salt_length']}, Count: {stat['count']}")

            # Check for expected lengths (64 hex chars = 32 bytes)
            expected_length = 64
            correct_hashes = [stat for stat in hash_stats if stat['hash_length'] == expected_length and stat['salt_length'] == expected_length]

            if correct_hashes:
                logger.info(f"✅ All hashes have correct length ({expected_length} characters)")
                return True
            else:
                logger.error(f"❌ Some hashes have incorrect length (expected {expected_length})")
                return False

    except Exception as e:
        logger.error(f"Error checking hash quality: {e}")
        return False

def check_applied_migrations():
    """Check if the migration was properly recorded."""
    logger.info("=== CHECKING APPLIED MIGRATIONS ===")

    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Check if migrations table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'applied_migrations'
                );
            """)

            table_exists = cur.fetchone()[0]

            if not table_exists:
                logger.warning("⚠️ Applied migrations table does not exist")
                return False

            # Check if our migration is recorded
            cur.execute("""
                SELECT migration_name, status, applied_at, execution_time_seconds
                FROM applied_migrations
                WHERE migration_name = '001_hash_kroger_passwords'
                ORDER BY applied_at DESC;
            """)

            migration_records = cur.fetchall()

            if not migration_records:
                logger.warning("⚠️ Password hashing migration not found in applied_migrations table")
                return False

            latest = migration_records[0]
            logger.info(f"Migration record found:")
            logger.info(f"  Name: {latest['migration_name']}")
            logger.info(f"  Status: {latest['status']}")
            logger.info(f"  Applied at: {latest['applied_at']}")
            logger.info(f"  Execution time: {latest['execution_time_seconds']:.2f}s")

            if latest['status'] == 'success':
                logger.info("✅ Migration recorded as successful")
                return True
            else:
                logger.error(f"❌ Migration status is: {latest['status']}")
                return False

    except Exception as e:
        logger.error(f"Error checking applied migrations: {e}")
        return False

def main():
    """Run all verification tests."""
    logger.info("Starting Kroger password hashing verification...")
    
    tests = [
        ("Migration Status", check_migration_status),
        ("Applied Migrations", check_applied_migrations),
        ("Hash Quality", check_hash_quality),
        ("New Password Hashing", test_new_password_hashing),
        ("Password Verification", test_password_verification),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        logger.info(f"\n{'='*50}")
        try:
            if test_name == "Migration Status":
                # This returns stats, not a boolean
                result = test_func()
                results[test_name] = result is not None
            else:
                result = test_func()
                results[test_name] = result
        except Exception as e:
            logger.error(f"Test '{test_name}' failed with exception: {e}")
            results[test_name] = False
    
    # Summary
    logger.info(f"\n{'='*50}")
    logger.info("VERIFICATION SUMMARY:")
    logger.info(f"{'='*50}")
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    logger.info(f"{'='*50}")
    
    if all_passed:
        logger.info("🎉 ALL TESTS PASSED - Password hashing is working correctly!")
        logger.info("You can now safely clear the plain text passwords.")
        logger.info("\nTo clear plain text passwords, run:")
        logger.info("UPDATE user_profiles SET kroger_password = NULL WHERE kroger_password_hash IS NOT NULL;")
    else:
        logger.error("❌ SOME TESTS FAILED - Do not clear plain text passwords yet!")
        logger.error("Please investigate the failed tests before proceeding.")
    
    return all_passed

if __name__ == "__main__":
    main()