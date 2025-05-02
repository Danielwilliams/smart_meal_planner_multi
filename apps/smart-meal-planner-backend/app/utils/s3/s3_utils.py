"""
AWS S3 utilities for handling image uploads and downloads
"""
import os
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException

# Configure more detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class S3Helper:
    def __init__(self):
        """Initialize S3 client connection using environment variables"""
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        
        # Debug logging of environment variables (masked for security)
        logger.debug(f"AWS_ACCESS_KEY_ID: {'SET' if self.aws_access_key else 'NOT SET'}")
        logger.debug(f"AWS_SECRET_ACCESS_KEY: {'SET' if self.aws_secret_key else 'NOT SET'}")
        
        # Parse region from STS URL if provided, or use environment variable
        aws_region_or_url = os.getenv("AWS_REGION", "us-east-2")
        logger.debug(f"AWS_REGION raw value: {aws_region_or_url}")
        
        if "amazonaws.com" in aws_region_or_url:
            # Extract region from URL like https://sts.us-east-2.amazonaws.com
            parts = aws_region_or_url.split('.')
            for part in parts:
                if part.startswith('us-') or part.startswith('eu-') or part.startswith('ap-') or part.startswith('sa-'):
                    self.region = part
                    break
            else:
                # Fallback if no region found in the URL
                self.region = "us-east-2"
            logger.info(f"Extracted region '{self.region}' from URL: {aws_region_or_url}")
        else:
            self.region = aws_region_or_url
            
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        logger.debug(f"S3_BUCKET_NAME: {self.bucket_name}")
        
        # More detailed validation
        missing_vars = []
        if not self.aws_access_key:
            missing_vars.append("AWS_ACCESS_KEY_ID")
        if not self.aws_secret_key:
            missing_vars.append("AWS_SECRET_ACCESS_KEY")
        if not self.bucket_name:
            missing_vars.append("S3_BUCKET_NAME")
            
        # Validate required configuration
        if missing_vars:
            error_msg = f"Missing required S3 configuration: {', '.join(missing_vars)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"Initializing S3 client with region: {self.region}, bucket: {self.bucket_name}")
        
        # Initialize S3 client
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region
            )
            
            # Test connection with a simple operation
            self.s3_client.list_buckets()
            logger.info("Successfully connected to AWS S3")
            
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {str(e)}")
            raise ValueError(f"S3 client initialization failed: {str(e)}")
    
    async def upload_image(self, file: UploadFile, folder: str = "recipe-images"):
        """
        Upload an image file to S3 bucket
        
        Args:
            file (UploadFile): The image file to upload
            folder (str): The folder within the bucket to store the image
            
        Returns:
            str: The URL of the uploaded image
        """
        try:
            # Log file information
            logger.debug(f"Upload request received for file: {file.filename}, content-type: {file.content_type}")
            logger.debug(f"Using bucket: {self.bucket_name}, region: {self.region}")
            
            # Generate a unique filename to avoid collisions
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            s3_path = f"{folder}/{unique_filename}"
            logger.debug(f"Generated S3 path: {s3_path}")
            
            # Read file content
            file_content = await file.read()
            logger.debug(f"Read file content: {len(file_content)} bytes")
            
            # Upload to S3
            logger.debug(f"Attempting to upload to S3 bucket: {self.bucket_name}")
            response = self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_path,
                Body=file_content,
                ContentType=file.content_type or "image/jpeg"
            )
            logger.debug(f"S3 put_object response: {response}")
            
            # Generate URL with region-specific endpoint format
            if self.region == "us-east-1":
                # Special case for us-east-1 which doesn't need region in the URL
                url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_path}"
            else:
                # Region-specific URL format
                url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_path}"
            logger.info(f"Image uploaded successfully to {url}")
            return url
            
        except ClientError as e:
            error_code = e.response['Error']['Code'] if 'Error' in e.response else 'Unknown'
            error_message = e.response['Error']['Message'] if 'Error' in e.response else str(e)
            logger.error(f"S3 upload error: Code={error_code}, Message={error_message}")
            logger.error(f"Error details: {e}")
            
            # Provide more context in the error message
            if error_code == 'InvalidAccessKeyId':
                detail = "Invalid AWS access key. Check AWS_ACCESS_KEY_ID environment variable."
            elif error_code == 'SignatureDoesNotMatch':
                detail = "Invalid AWS secret key. Check AWS_SECRET_ACCESS_KEY environment variable."
            elif error_code == 'NoSuchBucket':
                detail = f"Bucket '{self.bucket_name}' does not exist. Check S3_BUCKET_NAME environment variable."
            elif error_code == 'AccessDenied':
                detail = "Access denied. Check IAM permissions for the provided credentials."
            else:
                detail = f"Error uploading image: {error_code} - {error_message}"
                
            raise HTTPException(status_code=500, detail=detail)
            
        except Exception as e:
            logger.error(f"Unexpected error uploading to S3: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected error uploading image: {str(e)}")
        finally:
            # Reset file position for potential future reads
            await file.seek(0)
    
    def delete_image(self, image_url: str):
        """
        Delete an image from S3 bucket using its URL
        
        Args:
            image_url (str): The URL of the image to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Extract the key from the URL
            if not image_url or not self.bucket_name in image_url:
                logger.warning(f"Cannot delete image: Invalid S3 URL: {image_url}")
                return False
                
            # Parse URL to get S3 key - handle both regional and non-regional URL formats
            if f"{self.bucket_name}.s3.amazonaws.com/" in image_url:
                key = image_url.split(f"{self.bucket_name}.s3.amazonaws.com/")[1]
            elif f"{self.bucket_name}.s3.{self.region}.amazonaws.com/" in image_url:
                key = image_url.split(f"{self.bucket_name}.s3.{self.region}.amazonaws.com/")[1]
            else:
                # Try to extract by looking for common patterns
                parts = image_url.split('/')
                bucket_index = -1
                for i, part in enumerate(parts):
                    if self.bucket_name in part and 's3' in part:
                        bucket_index = i
                        break
                
                if bucket_index >= 0 and bucket_index + 1 < len(parts):
                    key = '/'.join(parts[bucket_index+1:])
                else:
                    logger.warning(f"Cannot parse S3 key from URL: {image_url}")
                    return False
            
            # Delete from S3
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            
            logger.info(f"Image deleted successfully: {key}")
            return True
            
        except ClientError as e:
            logger.error(f"S3 delete error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting from S3: {str(e)}")
            return False

# Function to force initialize S3 helper at runtime
def force_initialize_s3_helper():
    """Attempt to initialize S3 helper at runtime after environment variables might be loaded"""
    global s3_helper
    logger.info("Attempting to force initialize S3 helper")
    
    # Debug print all environment variables
    for key, value in os.environ.items():
        if "S3" in key or "AWS" in key:
            # Mask sensitive values
            if "KEY" in key or "SECRET" in key:
                logger.info(f"ENV: {key}=*******")
            else:
                logger.info(f"ENV: {key}={value}")
    
    # Check if environment variables are available now
    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY") 
    bucket_name = os.getenv("S3_BUCKET_NAME")
    aws_region = os.getenv("AWS_REGION", "us-east-2")
    
    logger.info(f"S3 variables available: access_key={bool(aws_access_key)}, secret_key={bool(aws_secret_key)}, bucket={bucket_name}, region={aws_region}")
    
    # Try to initialize if we have all required values
    if aws_access_key and aws_secret_key and bucket_name:
        try:
            logger.info("Attempting to create S3Helper with available credentials")
            real_s3_helper = S3Helper()
            logger.info(f"Successfully created S3Helper with bucket: {real_s3_helper.bucket_name}")
            s3_helper = real_s3_helper
            return real_s3_helper
        except Exception as e:
            logger.error(f"Failed to initialize S3Helper at runtime: {str(e)}", exc_info=True)
    else:
        logger.error("Missing required S3 environment variables for runtime initialization")
        
    # Log that we couldn't initialize
    logger.error("Failed to initialize S3 helper with environment variables")
    logger.error("Please set the AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables in your Railway deployment")
    
    # NEVER use hardcoded credentials - this is a security risk!
    # Instead, return the existing helper which will raise appropriate errors
        
    return s3_helper

# Try to create the singleton instance
try:
    s3_helper = S3Helper()
    logger.info(f"S3Helper initialized successfully with bucket: {s3_helper.bucket_name}")
except ValueError as e:
    logger.warning(f"S3Helper initialization failed: {str(e)}")
    # Create a placeholder that will attempt runtime initialization when called
    class DummyS3Helper:
        def __init__(self):
            self.bucket_name = None
            
        async def upload_image(self, file, folder="recipe-images"):
            logger.error("S3 helper initialization failed. Attempting on-demand initialization.")
            # Try to initialize on demand if called after environment variables are set
            s3 = force_initialize_s3_helper()
            if not hasattr(s3, 'bucket_name') or s3.bucket_name is None:
                raise HTTPException(
                    status_code=500, 
                    detail="S3 configuration is missing or incomplete. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables."
                )
            return await s3.upload_image(file, folder)
            
        def delete_image(self, image_url):
            logger.error("S3 helper initialization failed. Attempting on-demand initialization.")
            # Try to initialize on demand
            s3 = force_initialize_s3_helper()
            if not hasattr(s3, 'bucket_name') or s3.bucket_name is None:
                return False
            return s3.delete_image(image_url)
    
    s3_helper = DummyS3Helper()
except Exception as e:
    logger.error(f"Unexpected error initializing S3Helper: {str(e)}")
    # Create a placeholder with the same interface that attempts runtime initialization
    class DummyS3Helper:
        def __init__(self):
            self.bucket_name = None
            
        async def upload_image(self, file, folder="recipe-images"):
            logger.error("S3 helper failed to initialize. Attempting on-demand initialization.")
            # Try to initialize on demand if called after environment variables are set
            s3 = force_initialize_s3_helper()
            if not hasattr(s3, 'bucket_name') or s3.bucket_name is None:
                raise HTTPException(
                    status_code=500, 
                    detail="S3 configuration is missing or incomplete. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables."
                )
            return await s3.upload_image(file, folder)
            
        def delete_image(self, image_url):
            logger.error("S3 helper failed to initialize. Attempting on-demand initialization.")
            # Try to initialize on demand
            s3 = force_initialize_s3_helper()
            if not hasattr(s3, 'bucket_name') or s3.bucket_name is None:
                return False
            return s3.delete_image(image_url)
    
    s3_helper = DummyS3Helper()