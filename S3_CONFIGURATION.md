# S3 Configuration for Smart Meal Planner

This document explains how to properly configure your AWS S3 bucket for use with the Smart Meal Planner application.

## Problem: 403 Forbidden Error

If your uploaded images are giving a 403 Forbidden error when trying to view them, this means your S3 bucket is not configured to allow public read access to the objects.

## Solution: Configure S3 for Public Access

### Option 1: Add a Bucket Policy (Recommended)

1. Go to the S3 console and select your bucket
2. Click on "Permissions" tab
3. Scroll down to "Bucket policy" and click "Edit"
4. Add this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadForGetBucketObjects",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::smartmealplanneriomultiuser-images/*"
        }
    ]
}
```

### Option 2: Disable Block Public Access Settings

1. In the S3 console, select your bucket
2. Click "Permissions" tab
3. Under "Block public access (bucket settings)", click "Edit"
4. Uncheck at least "Block public access to buckets and objects granted through new access control lists (ACLs)" and "Block public access to buckets and objects granted through any access control lists (ACLs)"
5. Save changes

### Option 3: Use Pre-signed URLs (More Secure Alternative)

If you need more security, you can modify the application to use pre-signed URLs instead of public access:

1. Keep your bucket private
2. Generate pre-signed URLs when serving images:

```python
def generate_presigned_url(object_key, expiration=3600):
    """Generate a presigned URL to share an S3 object"""
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': S3_BUCKET_NAME,
                                                            'Key': object_key},
                                                    ExpiresIn=expiration)
        return response
    except Exception as e:
        print(e)
        return None
```

## Testing Your Configuration

After making changes to your S3 bucket configuration:

1. Try uploading a new image
2. Check if you can access the image URL directly in your browser
3. If you still get a 403 error, verify your bucket policy and permissions

## IAM User Requirements

Ensure your IAM user has these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::smartmealplanneriomultiuser-images",
                "arn:aws:s3:::smartmealplanneriomultiuser-images/*"
            ]
        }
    ]
}
```

Note the addition of `s3:PutObjectAcl` which is required for setting the public-read ACL on objects.