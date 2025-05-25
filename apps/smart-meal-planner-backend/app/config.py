# config.py
import os
import logging
from dotenv import load_dotenv
from urllib.parse import urlparse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Check for required environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not found in environment variables")
    # Don't raise an error here, just log the warning

DATABASE_URL = os.getenv("DATABASE_URL")


parsed_url = urlparse(DATABASE_URL)
DB_NAME = parsed_url.path[1:]  # Skip leading '/'
DB_USER = parsed_url.username
DB_PASSWORD = parsed_url.password
DB_HOST = parsed_url.hostname
DB_PORT = parsed_url.port

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")  # Default to us-east-1 if not specified
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

# Log S3 configuration status
if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME]):
    logger.warning("S3 configuration incomplete. Image upload functionality may not work properly.")



# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "DEFAULT_SECRET")
JWT_ALGORITHM = "HS256"

# External API configurations
WALMART_API_KEY = os.getenv("WALMART_API_KEY", "")
WALMART_BASE_URL = os.getenv("WALMART_BASE_URL", "https://api.walmart.com/v3")
WALMART_CLIENT_ID = os.getenv("WALMART_CLIENT_ID", "")
WALMART_CLIENT_SECRET = os.getenv("WALMART_CLIENT_SECRET", "")

KROGER_API_TOKEN = os.getenv("KROGER_API_TOKEN", "")
KROGER_BASE_URL = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID", "")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET", "")
KROGER_REDIRECT_URI = os.getenv("KROGER_REDIRECT_URI", "http://127.0.0.1:8000/callback")

# Recaptcha configuration
RECAPTCHA_SITE_KEY = os.getenv("RECAPTCHA_SITE_KEY", "")
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")

# Email configuration
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "signup@smartmealplannerio.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", ".*+~?00D7y;,bV1t")
SMTP_SERVER = os.getenv("SMTP_SERVER", "mboxhosting.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
FRONTEND_URL = "https://smartmealplannerio.com"


def debug_environment_vars():
    kroger_vars = [
        "KROGER_CLIENT_ID", 
        "KROGER_CLIENT_SECRET", 
        "KROGER_BASE_URL", 
        "KROGER_REDIRECT_URI", 
        "DEFAULT_KROGER_LOCATION_ID"
    ]
    
    for var in kroger_vars:
        value = os.getenv(var)
        print(f"{var}: {'set' if value else 'NOT set'}")

# Validate critical environment variables
def validate_environment():
    critical_vars = [
        ("OPENAI_API_KEY", OPENAI_API_KEY),
        ("DATABASE_USER", DB_USER),
        ("DATABASE_PASSWORD", DB_PASSWORD),
        ("JWT_SECRET", JWT_SECRET)
    ]
    
    missing_vars = [var for var, value in critical_vars if not value]
    
    if missing_vars:
        logger.error(f"Missing critical environment variables: {', '.join(missing_vars)}")
        return False
    
    # Check S3 configuration but don't fail validation if missing
    s3_vars = [
        ("AWS_ACCESS_KEY_ID", AWS_ACCESS_KEY_ID),
        ("AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY),
        ("S3_BUCKET_NAME", S3_BUCKET_NAME)
    ]
    
    missing_s3_vars = [var for var, value in s3_vars if not value]
    if missing_s3_vars:
        logger.warning(f"Missing S3 configuration variables: {', '.join(missing_s3_vars)}")
    
    return True

# Run validation on import
is_valid_env = validate_environment()