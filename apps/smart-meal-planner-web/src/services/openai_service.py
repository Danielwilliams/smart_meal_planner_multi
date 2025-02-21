# app/services/openai_service.py
import os
import openai
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self):
        self.api_key = os.environ.get('OPENAI_API_KEY')
        if not self.api_key:
            logger.error("OPENAI_API_KEY not found in environment variables")
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Explicitly set the API key
        openai.api_key = self.api_key
        logger.info("OpenAI API key configured successfully")

    def generate_completion(self, prompt: str) -> Optional[str]:
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
                temperature=0,
                top_p=1
            )
            return response.choices[0].message["content"].strip()
        except Exception as e:
            logger.error(f"Error in OpenAI completion: {str(e)}")
            raise
