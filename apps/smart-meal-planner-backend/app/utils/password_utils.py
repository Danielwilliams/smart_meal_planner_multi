# app/utils/password_utils.py

import hashlib
import os
import secrets
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with a salt.
    
    Args:
        password: The plain text password to hash
        salt: Optional salt to use. If not provided, a new salt will be generated
        
    Returns:
        tuple: (hashed_password, salt) - both as hex strings
    """
    if not password:
        return "", ""
    
    if salt is None:
        # Generate a random salt
        salt = secrets.token_hex(32)
    elif isinstance(salt, str) and len(salt) != 64:
        # If salt is provided but not the right length, generate a new one
        logger.warning(f"Invalid salt length {len(salt)}, generating new salt")
        salt = secrets.token_hex(32)
    
    # Convert hex salt to bytes if it's a string
    if isinstance(salt, str):
        salt_bytes = bytes.fromhex(salt)
    else:
        salt_bytes = salt
        salt = salt.hex()
    
    # Hash the password
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt_bytes,
        100000  # 100,000 iterations
    )
    
    return hashed.hex(), salt

def verify_password(password: str, hashed_password: str, salt: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        password: The plain text password to verify
        hashed_password: The stored hashed password (hex string)
        salt: The salt used for hashing (hex string)
        
    Returns:
        bool: True if password is correct, False otherwise
    """
    if not password or not hashed_password or not salt:
        return False
    
    try:
        # Hash the provided password with the stored salt
        computed_hash, _ = hash_password(password, salt)
        
        # Compare the hashes
        return secrets.compare_digest(computed_hash, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {str(e)}")
        return False

def is_password_hashed(password: str) -> bool:
    """
    Check if a password appears to be already hashed.
    
    Args:
        password: The password string to check
        
    Returns:
        bool: True if the password appears to be hashed, False if it's plain text
    """
    if not password:
        return False
    
    # Check if it's a hex string of appropriate length for our hash
    # PBKDF2-HMAC-SHA256 produces 32 bytes = 64 hex characters
    if len(password) == 64:
        try:
            # Try to decode as hex
            bytes.fromhex(password)
            return True
        except ValueError:
            return False
    
    return False

def hash_kroger_password(plain_password: str) -> tuple[str, str]:
    """
    Specifically hash a Kroger password for storage.
    
    Args:
        plain_password: The plain text Kroger password
        
    Returns:
        tuple: (hashed_password, salt) - both as hex strings
    """
    if not plain_password:
        return "", ""
    
    return hash_password(plain_password)

def verify_kroger_password(plain_password: str, stored_hash: str, stored_salt: str) -> bool:
    """
    Verify a Kroger password against its stored hash.
    
    Args:
        plain_password: The plain text password to verify
        stored_hash: The stored hashed password
        stored_salt: The stored salt
        
    Returns:
        bool: True if password is correct, False otherwise
    """
    return verify_password(plain_password, stored_hash, stored_salt)