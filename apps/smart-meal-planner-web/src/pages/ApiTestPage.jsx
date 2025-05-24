import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Button,
  TextField,
  Box,
  Paper,
  Grid,
  Alert,
  AlertTitle,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Chip
} from '@mui/material';

/**
 * A simple page to test API connections and diagnose issues
 */
const ApiTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [zipCode, setZipCode] = useState('80537');
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState(null);
  const [backendUrl, setBackendUrl] = useState('https://smartmealplannermulti-development.up.railway.app');

  // Test endpoint access with different methods
  const testEndpoints = async () => {
    setLoading(true);
    setError(null);
    setTestResults({});

    try {
      const results = {};
      
      // Test basic direct endpoint
      try {
        const directResponse = await axios.get(`${backendUrl}/health`);
        results.directApi = {
          status: 'success',
          statusCode: directResponse.status,
          data: directResponse.data
        };
      } catch (err) {
        results.directApi = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          error: err.message
        };
      }

      // Test retailers endpoint (direct)
      try {
        const retailersResponse = await axios.get(`${backendUrl}/instacart/retailers`);
        results.retailersApi = {
          status: 'success',
          statusCode: retailersResponse.status,
          data: {
            count: Array.isArray(retailersResponse.data) ? retailersResponse.data.length : 'Not an array',
            sample: Array.isArray(retailersResponse.data) ? retailersResponse.data.slice(0, 2) : retailersResponse.data
          }
        };
      } catch (err) {
        results.retailersApi = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          error: err.message
        };
      }

      // Test nearby retailers endpoint (direct)
      if (zipCode) {
        try {
          const nearbyResponse = await axios.get(`${backendUrl}/instacart/retailers/nearby`, {
            params: { zip_code: zipCode }
          });
          results.nearbyApi = {
            status: 'success',
            statusCode: nearbyResponse.status,
            data: {
              count: Array.isArray(nearbyResponse.data) ? nearbyResponse.data.length : 'Not an array',
              sample: Array.isArray(nearbyResponse.data) ? nearbyResponse.data.slice(0, 2) : nearbyResponse.data
            }
          };
        } catch (err) {
          results.nearbyApi = {
            status: 'error',
            statusCode: err.response?.status || 'Network Error',
            error: err.message
          };
        }
      }

      // Test relative API paths
      try {
        const relativeApiResponse = await axios.get('/api/health');
        results.relativeApi = {
          status: 'success',
          statusCode: relativeApiResponse.status,
          data: relativeApiResponse.data
        };
      } catch (err) {
        results.relativeApi = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          error: err.message
        };
      }

      // Test retailers with relative path
      try {
        const relativeRetailersResponse = await axios.get('/api/instacart/retailers');
        results.relativeRetailersApi = {
          status: 'success',
          statusCode: relativeRetailersResponse.status,
          data: {
            count: Array.isArray(relativeRetailersResponse.data) ? relativeRetailersResponse.data.length : 'Not an array',
            sample: Array.isArray(relativeRetailersResponse.data) ? relativeRetailersResponse.data.slice(0, 2) : relativeRetailersResponse.data
          }
        };
      } catch (err) {
        results.relativeRetailersApi = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          error: err.message
        };
      }

      // Set the results
      setTestResults(results);
    } catch (err) {
      setError(`Test failed: ${err.message}`);
      console.error('API test error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Test environment info
  const testEnvironment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const envInfo = {};
      
      // Browser information
      envInfo.browser = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled
      };
      
      // Current URL info
      const urlObj = new URL(window.location.href);
      envInfo.currentUrl = {
        protocol: urlObj.protocol,
        host: urlObj.host,
        pathname: urlObj.pathname,
        origin: urlObj.origin
      };
      
      // CORS Headers test
      try {
        const corsResponse = await axios.options(`${backendUrl}/health`, {
          headers: {
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'X-Instacart-API-Key',
            'Origin': window.location.origin
          }
        });
        
        envInfo.corsHeaders = {
          status: 'success',
          statusCode: corsResponse.status,
          headers: corsResponse.headers
        };
      } catch (err) {
        envInfo.corsHeaders = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          message: err.message,
          headers: err.response?.headers
        };
      }
      
      // Backend environment info (if available)
      try {
        const backendEnvResponse = await axios.get(`${backendUrl}/instacart/environment`);
        envInfo.backendEnvironment = {
          status: 'success',
          data: backendEnvResponse.data
        };
      } catch (err) {
        envInfo.backendEnvironment = {
          status: 'error',
          statusCode: err.response?.status || 'Network Error',
          message: err.message
        };
      }
      
      setTestResults(prevResults => ({
        ...prevResults,
        environment: envInfo
      }));
    } catch (err) {
      setError(`Environment test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test with fetch API instead of axios
  const testWithFetch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchResults = {};
      
      // Direct fetch
      try {
        const directResponse = await fetch(`${backendUrl}/health`);
        const directData = await directResponse.json();
        
        fetchResults.directFetch = {
          status: 'success',
          statusCode: directResponse.status,
          data: directData
        };
      } catch (err) {
        fetchResults.directFetch = {
          status: 'error',
          error: err.message
        };
      }
      
      // Fetch retailers
      try {
        const retailersResponse = await fetch(`${backendUrl}/instacart/retailers`);
        const retailersData = await retailersResponse.json();
        
        fetchResults.retailersFetch = {
          status: 'success',
          statusCode: retailersResponse.status,
          data: {
            count: Array.isArray(retailersData) ? retailersData.length : 'Not an array',
            sample: Array.isArray(retailersData) ? retailersData.slice(0, 2) : retailersData
          }
        };
      } catch (err) {
        fetchResults.retailersFetch = {
          status: 'error',
          error: err.message
        };
      }
      
      // Relative fetch
      try {
        const relativeResponse = await fetch('/api/health');
        const relativeData = await relativeResponse.json();
        
        fetchResults.relativeFetch = {
          status: 'success', 
          statusCode: relativeResponse.status,
          data: relativeData
        };
      } catch (err) {
        fetchResults.relativeFetch = {
          status: 'error',
          error: err.message
        };
      }
      
      setTestResults(prevResults => ({
        ...prevResults,
        fetch: fetchResults
      }));
    } catch (err) {
      setError(`Fetch test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render the test results
  const renderTestResults = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (Object.keys(testResults).length === 0) {
      return (
        <Alert severity="info">
          <AlertTitle>No Tests Run Yet</AlertTitle>
          Run a test to see results here
        </Alert>
      );
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Axios Results" />
          <Tab label="Fetch Results" />
          <Tab label="Environment Info" />
        </Tabs>

        {selectedTab === 0 && renderAxiosResults()}
        {selectedTab === 1 && renderFetchResults()}
        {selectedTab === 2 && renderEnvironmentInfo()}
      </Box>
    );
  };

  // Render Axios test results
  const renderAxiosResults = () => {
    const axiosTests = [
      { key: 'directApi', name: 'Direct API Health Check' },
      { key: 'retailersApi', name: 'Retailers API (Direct)' },
      { key: 'nearbyApi', name: 'Nearby Retailers API (Direct)' },
      { key: 'relativeApi', name: 'Relative API Health Check' },
      { key: 'relativeRetailersApi', name: 'Retailers API (Relative)' }
    ];

    return (
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          {axiosTests.map(test => {
            const result = testResults[test.key];
            return (
              <Grid item xs={12} key={test.key}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">{test.name}</Typography>
                    <Chip 
                      label={result?.status || 'Not Run'} 
                      color={result?.status === 'success' ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                  
                  {result?.status === 'success' ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Status: {result.statusCode}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Response:</Typography>
                      <Paper sx={{ p: 1, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
                        <pre style={{ margin: 0 }}>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  ) : (
                    <Alert severity="error">
                      {result?.statusCode ? `Status: ${result.statusCode}` : ''} 
                      {result?.error ? ` - ${result.error}` : ''}
                    </Alert>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  // Render Fetch test results
  const renderFetchResults = () => {
    const fetchTests = [
      { key: 'directFetch', name: 'Direct Fetch Health Check' },
      { key: 'retailersFetch', name: 'Retailers Fetch (Direct)' },
      { key: 'relativeFetch', name: 'Relative Fetch Health Check' },
    ];

    if (!testResults.fetch) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No fetch tests have been run yet. Click "Test with Fetch API" to run these tests.
        </Alert>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          {fetchTests.map(test => {
            const result = testResults.fetch?.[test.key];
            if (!result) return null;
            
            return (
              <Grid item xs={12} key={test.key}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">{test.name}</Typography>
                    <Chip 
                      label={result?.status || 'Not Run'} 
                      color={result?.status === 'success' ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                  
                  {result?.status === 'success' ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Status: {result.statusCode}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Response:</Typography>
                      <Paper sx={{ p: 1, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
                        <pre style={{ margin: 0 }}>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  ) : (
                    <Alert severity="error">
                      {result?.error}
                    </Alert>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  // Render environment information
  const renderEnvironmentInfo = () => {
    if (!testResults.environment) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No environment tests have been run yet. Click "Test Environment" to run these tests.
        </Alert>
      );
    }

    const { browser, currentUrl, corsHeaders, backendEnvironment } = testResults.environment;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Browser Information</Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="User Agent" secondary={browser.userAgent} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Language" secondary={browser.language} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Platform" secondary={browser.platform} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Cookies Enabled" secondary={browser.cookiesEnabled ? 'Yes' : 'No'} />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Current URL</Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Protocol" secondary={currentUrl.protocol} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Host" secondary={currentUrl.host} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Origin" secondary={currentUrl.origin} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Path" secondary={currentUrl.pathname} />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>CORS Headers Test</Typography>
              {corsHeaders.status === 'success' ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  CORS pre-flight request succeeded with status {corsHeaders.statusCode}
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  CORS pre-flight request failed: {corsHeaders.message}
                </Alert>
              )}
              
              <Typography variant="subtitle2">Headers:</Typography>
              <Paper sx={{ p: 1, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
                <pre style={{ margin: 0 }}>
                  {JSON.stringify(corsHeaders.headers, null, 2)}
                </pre>
              </Paper>
            </Paper>
          </Grid>
          
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Backend Environment</Typography>
              {backendEnvironment.status === 'success' ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Successfully retrieved backend environment information
                  </Alert>
                  <Paper sx={{ p: 1, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(backendEnvironment.data, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              ) : (
                <Alert severity="error">
                  Failed to retrieve backend environment: {backendEnvironment.message}
                  {backendEnvironment.statusCode ? ` (Status: ${backendEnvironment.statusCode})` : ''}
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" gutterBottom>API Connection Tester</Typography>
        <Typography variant="body1" paragraph>
          This page helps diagnose API connection issues between the frontend and backend.
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              label="Backend URL"
              variant="outlined"
              fullWidth
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              helperText="The base URL of the backend API"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="ZIP Code"
              variant="outlined"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              helperText="For testing nearby retailers endpoint"
              size="small"
            />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            onClick={testEndpoints}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
            Test API Endpoints
          </Button>
          
          <Button
            variant="outlined"
            onClick={testWithFetch}
            disabled={loading}
          >
            Test with Fetch API
          </Button>
          
          <Button
            variant="outlined"
            onClick={testEnvironment}
            disabled={loading}
          >
            Test Environment
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
      
      {renderTestResults()}
      
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h5" gutterBottom>Troubleshooting Tips</Typography>
        <List>
          <ListItem>
            <ListItemText 
              primary="CORS Issues" 
              secondary="If direct API calls fail but relative calls work, you likely have CORS issues. Make sure your backend allows requests from your frontend domain."
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="404 Errors" 
              secondary="If you see 404 errors, check that the endpoints exist and that your proxy is correctly configured."
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Proxy Configuration" 
              secondary="For Vercel deployments, check your vercel.json file. For Heroku, check your static.json file."
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Authentication Issues" 
              secondary="If you see 401 or 403 errors, there might be issues with authentication or API keys."
            />
          </ListItem>
        </List>
      </Paper>
    </Container>
  );
};

export default ApiTestPage;