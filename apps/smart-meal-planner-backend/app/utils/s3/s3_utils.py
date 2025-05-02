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
        # Try to get environment variables directly from os.environ first, then fall back to os.getenv
        # Railway may require direct access to os.environ
        self.aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
        
        # Debug logging of environment variables (masked for security)
        logger.debug(f"AWS_ACCESS_KEY_ID: {'SET' if self.aws_access_key else 'NOT SET'}")
        logger.debug(f"AWS_SECRET_ACCESS_KEY: {'SET' if self.aws_secret_key else 'NOT SET'}")
        
        # Try both methods for region and bucket name
        bucket_direct = os.environ.get("S3_BUCKET_NAME")
        bucket_getenv = os.getenv("S3_BUCKET_NAME")
        region_direct = os.environ.get("AWS_REGION")
        region_getenv = os.getenv("AWS_REGION", "us-east-2")
        
        logger.debug(f"S3_BUCKET_NAME (direct): {bucket_direct}")
        logger.debug(f"S3_BUCKET_NAME (getenv): {bucket_getenv}")
        logger.debug(f"AWS_REGION (direct): {region_direct}")
        logger.debug(f"AWS_REGION (getenv): {region_getenv}")
        
        # Use the first available value
        aws_region_or_url = region_direct or region_getenv or "us-east-2"
        logger.info(f"AWS_REGION raw value: {aws_region_or_url}")
        
        # Parse the region
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
        
        # Get bucket name
        self.bucket_name = bucket_direct or bucket_getenv
        logger.info(f"S3_BUCKET_NAME: {self.bucket_name}")
        
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
            logger.info(f"Creating boto3 S3 client with access_key={self.aws_access_key[:4]}*** and region={self.region}")
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region
            )
            
            # Test connection with a simple operation that only requires bucket-specific permissions
            # We'll try to list objects in the bucket instead of listing all buckets
            try:
                # Just try to list objects in the specific bucket (max 1 item)
                # This only requires permission to the specific bucket
                resp = self.s3_client.list_objects_v2(
                    Bucket=self.bucket_name,
                    MaxKeys=1
                )
                logger.info(f"Successfully connected to AWS S3 bucket '{self.bucket_name}'")
                if 'Contents' in resp and len(resp['Contents']) > 0:
                    logger.info(f"Bucket contains at least {len(resp['Contents'])} objects")
                else:
                    logger.info(f"Bucket exists but is empty")
            except self.s3_client.exceptions.NoSuchBucket:
                logger.warning(f"Bucket '{self.bucket_name}' does not exist")
                raise ValueError(f"Bucket '{self.bucket_name}' does not exist")
            except Exception as bucket_err:
                logger.warning(f"Could not verify bucket '{self.bucket_name}': {str(bucket_err)}")
                # Continue anyway, as we might have permission to put objects but not list them
            
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
    
    # Try reading from environment - Railway specific handling
    try:
        # Directly read from os.environ for Railway compatibility
        aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
        bucket_name = os.environ.get("S3_BUCKET_NAME") or os.getenv("S3_BUCKET_NAME")
        aws_region = os.environ.get("AWS_REGION") or os.getenv("AWS_REGION", "us-east-2")
        
        # Debug log (mask sensitive values)
        logger.info(f"Access Key Present: {bool(aws_access_key)}")
        logger.info(f"Secret Key Present: {bool(aws_secret_key)}")
        logger.info(f"Bucket Name: {bucket_name}")
        logger.info(f"Region: {aws_region}")
        
        # Explicitly update environment for Railway
        if aws_access_key:
            os.environ["AWS_ACCESS_KEY_ID"] = aws_access_key
        if aws_secret_key:
            os.environ["AWS_SECRET_ACCESS_KEY"] = aws_secret_key
        if bucket_name:
            os.environ["S3_BUCKET_NAME"] = bucket_name
        if aws_region:
            os.environ["AWS_REGION"] = aws_region
        
        # Try to initialize if we have all required values
        if aws_access_key and aws_secret_key and bucket_name:
            try:
                # Log that we are creating an S3 client
                logger.info(f"Creating boto3 S3 client with access_key={aws_access_key[:4]}*** and region={aws_region}")
                
                # Create an S3 client directly first to test connection
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=aws_access_key,
                    aws_secret_access_key=aws_secret_key,
                    region_name=aws_region
                )
                
                # Try a bucket-specific operation instead of listing all buckets
                try:
                    # Just check that we can access the specific bucket we need
                    s3_client.head_bucket(Bucket=bucket_name)
                    logger.info(f"Successfully verified bucket exists: {bucket_name}")
                except s3_client.exceptions.NoSuchBucket:
                    logger.error(f"Bucket does not exist: {bucket_name}")
                    raise ValueError(f"S3 bucket '{bucket_name}' does not exist")
                except Exception as e:
                    # If we can't access bucket info, try listing objects as a fallback
                    logger.warning(f"Could not verify bucket with head_bucket: {str(e)}")
                    try:
                        # Try with list_objects_v2 instead
                        s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
                        logger.info(f"Successfully verified bucket with list_objects: {bucket_name}")
                    except Exception as list_err:
                        logger.warning(f"Could not list objects in bucket: {str(list_err)}")
                        # Continue anyway - we'll try upload operations directly
                
                logger.info(f"Successfully connected to AWS with direct boto3 client")
                
                # Now create the full helper
                logger.info("Creating S3Helper with verified credentials")
                real_s3_helper = S3Helper()
                logger.info(f"Successfully created S3Helper with bucket: {real_s3_helper.bucket_name}")
                s3_helper = real_s3_helper
                return real_s3_helper
            except Exception as e:
                logger.error(f"Failed to initialize S3Helper at runtime: {str(e)}", exc_info=True)
        else:
            logger.error("Missing required S3 environment variables for runtime initialization")
            missing_vars = []
            if not aws_access_key:
                missing_vars.append("AWS_ACCESS_KEY_ID")
            if not aws_secret_key:
                missing_vars.append("AWS_SECRET_ACCESS_KEY")
            if not bucket_name:
                missing_vars.append("S3_BUCKET_NAME")
            logger.error(f"Missing variables: {', '.join(missing_vars)}")
    except Exception as e:
        logger.error(f"Unexpected error during environment variable processing: {str(e)}", exc_info=True)
        
    # Log that we couldn't initialize
    logger.error("Failed to initialize S3 helper with environment variables")
    logger.error("Please set the AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables in your Railway deployment")
    
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