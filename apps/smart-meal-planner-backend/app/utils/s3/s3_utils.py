"""
AWS S3 utilities for handling image uploads and downloads
"""
import os
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)

class S3Helper:
    def __init__(self):
        """Initialize S3 client connection using environment variables"""
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        
        # Validate required configuration
        if not all([self.aws_access_key, self.aws_secret_key, self.bucket_name]):
            logger.error("Missing required S3 configuration. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME")
            raise ValueError("Missing required S3 configuration")
        
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=self.aws_access_key,
            aws_secret_access_key=self.aws_secret_key,
            region_name=self.region
        )
    
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
            # Generate a unique filename to avoid collisions
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            s3_path = f"{folder}/{unique_filename}"
            
            # Read file content
            file_content = await file.read()
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_path,
                Body=file_content,
                ContentType=file.content_type or "image/jpeg"
            )
            
            # Generate URL
            url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_path}"
            logger.info(f"Image uploaded successfully to {url}")
            return url
            
        except ClientError as e:
            logger.error(f"S3 upload error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error uploading to S3: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
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
                
            # Parse URL to get S3 key
            key = image_url.split(f"{self.bucket_name}.s3.amazonaws.com/")[1]
            
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

# Create a singleton instance
s3_helper = S3Helper