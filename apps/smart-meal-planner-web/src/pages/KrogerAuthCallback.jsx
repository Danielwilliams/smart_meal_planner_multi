// src/pages/KrogerAuthCallback.jsx - Simple implementation matching the single-user app
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// This component is intentionally minimal, just like the single-user app
function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const code = searchParams.get('code');
    
    if (code) {
      console.log('Kroger code received, redirecting to backend');
      
      // CRITICAL: The single-user app uses a direct browser redirect through a simple <a> tag click
      // We'll mimic this by creating and clicking an <a> element programmatically
      
      // Create an anchor element
      const anchor = document.createElement('a');
      
      // Backend URL
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
      
      // Set the href to the backend callback URL
      anchor.href = `${API_BASE_URL}/kroger/auth-callback?code=${encodeURIComponent(code)}`;
      
      // Append to document
      document.body.appendChild(anchor);
      
      // Simulate a click
      anchor.click();
      
      // Clean up
      document.body.removeChild(anchor);
    } else {
      console.log('No code received, will redirect to cart page');
      window.location.href = '/cart';
    }
  }, [searchParams]);
  
  // No visible UI needed - just like the single-user app
  return null;
}

export default KrogerAuthCallback;
