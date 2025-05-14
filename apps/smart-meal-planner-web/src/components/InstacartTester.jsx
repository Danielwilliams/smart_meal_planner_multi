import React, { useState } from 'react';
import axios from 'axios';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';

const InstacartTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [zipCode, setZipCode] = useState('80538');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const testConnection = async (endpoint) => {
    if (!apiKey.trim()) {
      setError('Please enter your Instacart API key');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const baseUrl = 'https://connect.dev.instacart.tools';
      const url = `${baseUrl}${endpoint}`;
      
      console.log(`Testing connection to: ${url}`);
      
      const response = await axios.get(url, {
        params: endpoint.includes('retailers') ? {
          postal_code: zipCode,
          country_code: 'US'
        } : {},
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `InstacartAPI ${apiKey}`
        }
      });
      
      setResult({
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      });
      
      console.log('Response:', response);
    } catch (err) {
      console.error('Error testing Instacart API:', err);
      
      setError({
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 3 }}>
      <Typography variant="h4" gutterBottom>
        Instacart API Tester
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Instacart API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          fullWidth
          margin="normal"
          type="password"
          required
          placeholder="Enter your Instacart API key"
        />
        
        <TextField
          label="Zip Code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          margin="normal"
          required
          placeholder="Enter zip code"
        />
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Button 
          variant="contained" 
          onClick={() => testConnection('/v1/retailers')}
          disabled={loading}
        >
          Test Retailers Endpoint (v1)
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => testConnection('/idp/v1/retailers')}
          disabled={loading}
        >
          Test Retailers Endpoint (idp/v1)
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => testConnection('/v1/health')}
          disabled={loading}
        >
          Test Health Endpoint
        </Button>
      </Box>
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Box sx={{ my: 3 }}>
          <Alert severity="error">
            <Typography variant="subtitle1">Error: {error.message}</Typography>
            {error.status && (
              <Typography variant="body2">
                Status: {error.status} {error.statusText}
              </Typography>
            )}
            {error.data && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2">Response Data:</Typography>
                <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(error.data, null, 2)}
                </pre>
              </Box>
            )}
          </Alert>
        </Box>
      )}
      
      {result && (
        <Box sx={{ my: 3 }}>
          <Alert severity="success">
            <Typography variant="subtitle1">
              Success! Status: {result.status} {result.statusText}
            </Typography>
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="subtitle2">Response Data:</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '400px' }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </Alert>
        </Box>
      )}
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Troubleshooting Tips:</Typography>
        <ul>
          <li>Make sure your API key is valid and active</li>
          <li>If getting CORS errors, this is expected when testing directly from the browser</li>
          <li>Try the different endpoints - some Instacart accounts use /v1, others use /idp/v1</li>
          <li>Check if your API key has permissions for the endpoints you're trying to access</li>
          <li>Network errors might indicate API service issues or incorrect endpoints</li>
        </ul>
      </Box>
    </Paper>
  );
};

export default InstacartTester;