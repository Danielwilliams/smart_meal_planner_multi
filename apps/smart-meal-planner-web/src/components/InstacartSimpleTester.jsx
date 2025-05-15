import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import instacartBackendService from '../services/instacartBackendService';

/**
 * Simplified component for testing Instacart API connectivity
 * using the backend proxy approach
 */
const InstacartSimpleTester = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [zipCode, setZipCode] = useState('80538');
  const [apiKeyInfo, setApiKeyInfo] = useState(null);
  const [backendInfo, setBackendInfo] = useState(null);

  // Get API key info from backend when component mounts
  useEffect(() => {
    const getApiKeyInfo = async () => {
      try {
        // Use instacartBackendService for consistent API access
        const response = await instacartBackendService.getApiKeyInfo();
        if (response) {
          setApiKeyInfo(response);
        }
      } catch (err) {
        console.warn('Error fetching API key info:', err.message);
        // Create a fallback object with error info
        setApiKeyInfo({
          exists: false,
          masked: 'Unknown',
          length: 'Unknown',
          error: err.message
        });
      }
    };

    const getBackendInfo = async () => {
      try {
        const response = await instacartBackendService.getEnvironmentInfo();
        if (response) {
          setBackendInfo(response);
        }
      } catch (err) {
        console.warn('Error fetching backend info:', err.message);
        setBackendInfo({
          error: err.message
        });
      }
    };

    getApiKeyInfo();
    getBackendInfo();
  }, []);

  const runApiTest = async () => {
    setLoading(true);
    setError('');
    setTestResults(null);

    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: []
      };

      // Get latest API key info for the test results
      try {
        const keyInfo = await instacartBackendService.getApiKeyInfo();
        if (keyInfo) {
          results.apiKeyInfo = keyInfo;
          setApiKeyInfo(keyInfo);
        }
      } catch (keyErr) {
        console.warn('Error getting latest API key info:', keyErr);
        results.apiKeyInfo = apiKeyInfo || {
          error: keyErr.message,
          exists: false,
          masked: 'Error fetching'
        };
      }

      // Test 1: Check API Status with detailed error handling
      try {
        console.log('Checking Instacart API status...');
        const statusResponse = await instacartBackendService.checkInstacartStatus();

        // Log the complete response for debugging
        console.log('Complete API status response:', statusResponse);

        results.tests.push({
          name: 'API Status Check',
          success: statusResponse.is_connected,
          data: statusResponse
        });
      } catch (statusErr) {
        // Capture complete error details
        const errorDetails = {
          message: statusErr.message,
          response: statusErr.response ? {
            status: statusErr.response.status,
            statusText: statusErr.response.statusText,
            data: statusErr.response.data
          } : null,
          request: statusErr.request ? 'Request was made but no response received' : null,
          stack: statusErr.stack
        };

        // Try to extract any debug_info that might be in the error response
        let errorData = null;
        try {
          if (statusErr.response && statusErr.response.data) {
            errorData = statusErr.response.data;
          }
        } catch (parseErr) {
          console.warn('Error parsing error response data:', parseErr);
        }

        results.tests.push({
          name: 'API Status Check',
          success: false,
          error: statusErr.message,
          errorDetails: errorDetails,
          data: errorData
        });
      }

      // Test 2: Get retailers by ZIP code with detailed error handling
      try {
        console.log(`Getting retailers for ZIP code ${zipCode}...`);
        const retailers = await instacartBackendService.getNearbyRetailers(zipCode);

        results.tests.push({
          name: 'Get Retailers',
          success: Array.isArray(retailers) && retailers.length > 0,
          data: {
            count: retailers.length,
            sample: retailers.slice(0, 2)
          }
        });

        // If retailers found, test product search
        if (Array.isArray(retailers) && retailers.length > 0) {
          const retailerId = retailers[0].id;

          try {
            console.log(`Searching products for retailer ${retailerId}...`);
            const products = await instacartBackendService.searchProducts(retailerId, 'milk', 3);

            results.tests.push({
              name: 'Search Products',
              success: Array.isArray(products) && products.length > 0,
              data: {
                count: products.length,
                sample: products.slice(0, 2)
              }
            });
          } catch (searchErr) {
            // Capture detailed error info
            const errorDetails = {
              message: searchErr.message,
              response: searchErr.response ? {
                status: searchErr.response.status,
                statusText: searchErr.response.statusText,
                data: searchErr.response.data
              } : null,
              request: searchErr.request ? 'Request was made but no response received' : null
            };

            // Try to extract any debug_info that might be in the error response
            let errorData = null;
            try {
              if (searchErr.response && searchErr.response.data) {
                errorData = searchErr.response.data;
              }
            } catch (parseErr) {
              console.warn('Error parsing error response data:', parseErr);
            }

            results.tests.push({
              name: 'Search Products',
              success: false,
              error: searchErr.message,
              errorDetails: errorDetails,
              data: errorData
            });
          }
        }
      } catch (retailersErr) {
        // Capture detailed error info
        const errorDetails = {
          message: retailersErr.message,
          response: retailersErr.response ? {
            status: retailersErr.response.status,
            statusText: retailersErr.response.statusText,
            data: retailersErr.response.data
          } : null,
          request: retailersErr.request ? 'Request was made but no response received' : null,
          stack: retailersErr.stack
        };

        // Try to extract any debug_info that might be in the error response
        let errorData = null;
        try {
          if (retailersErr.response && retailersErr.response.data) {
            errorData = retailersErr.response.data;
          }
        } catch (parseErr) {
          console.warn('Error parsing error response data:', parseErr);
        }

        results.tests.push({
          name: 'Get Retailers',
          success: false,
          error: retailersErr.message,
          errorDetails: errorDetails,
          data: errorData
        });
      }

      // Calculate overall success
      const successCount = results.tests.filter(test => test.success).length;
      results.overallSuccess = successCount === results.tests.length;
      
      setTestResults(results);
    } catch (err) {
      setError(`Error running tests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 4 }}>
      <Typography variant="h5" gutterBottom>
        Instacart API Tester
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        This tool tests the connection to the Instacart API through our backend server.
      </Typography>

      {/* API Key Information */}
      <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8f8f8' }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          API Key Information
        </Typography>

        {apiKeyInfo ? (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>API Key Present:</strong> {apiKeyInfo.exists ? 'Yes' : 'No'}
              </Typography>
              <Typography variant="body2">
                <strong>API Key:</strong> {apiKeyInfo.masked || 'Unknown'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Length:</strong> {apiKeyInfo.length || 'Unknown'} characters
              </Typography>
              <Typography variant="body2">
                <strong>Format:</strong> {apiKeyInfo.format || 'Unknown'}
              </Typography>
            </Grid>
            {apiKeyInfo.error && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Error fetching API key info: {apiKeyInfo.error}
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Loading API key information...
          </Typography>
        )}

        {backendInfo && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Backend Environment:
            </Typography>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              {JSON.stringify(backendInfo, null, 2)}
            </pre>
          </Box>
        )}
      </Card>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }}>
        <TextField
          label="ZIP Code"
          variant="outlined"
          size="small"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          placeholder="e.g. 80538"
          sx={{ mr: 2, width: 150 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={runApiTest}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Test API Connection
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {testResults && (
        <Box sx={{ mt: 3 }}>
          <Alert
            severity={testResults.overallSuccess ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            {testResults.overallSuccess 
              ? 'All tests passed! The Instacart API connection is working properly.' 
              : 'Some tests failed. There might be an issue with the Instacart API connection.'}
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Tests run at: {new Date(testResults.timestamp).toLocaleString()}
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {testResults.tests.map((test, index) => (
              <Grid item xs={12} key={index}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2,
                    backgroundColor: test.success ? '#f0fff0' : '#fff0f0'
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    color={test.success ? 'success.main' : 'error.main'}
                    gutterBottom
                  >
                    {test.name}: {test.success ? 'Success' : 'Failed'}
                  </Typography>
                  
                  {test.success ? (
                    <Box>
                      {test.data && (
                        <React.Fragment>
                          <pre style={{
                            backgroundColor: '#f5f5f5',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            overflow: 'auto',
                            maxHeight: '200px'
                          }}>
                            {JSON.stringify(test.data, null, 2)}
                          </pre>

                          {/* Display debug info for successful responses too */}
                          {test.data.debug_info && (
                            <Box mt={2}>
                              <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography variant="subtitle2">API Diagnostic Information</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <pre style={{
                                    backgroundColor: '#f8f8f8',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    overflow: 'auto',
                                    maxHeight: '400px'
                                  }}>
                                    {JSON.stringify(test.data.debug_info, null, 2)}
                                  </pre>
                                </AccordionDetails>
                              </Accordion>
                            </Box>
                          )}
                        </React.Fragment>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      <Typography color="error.main" gutterBottom>
                        Error: {test.error}
                      </Typography>

                      {test.errorDetails && (
                        <Box mt={1}>
                          <Typography variant="subtitle2" gutterBottom>
                            Detailed Error Information:
                          </Typography>

                          {test.errorDetails.response && (
                            <Box mb={1}>
                              <Typography variant="body2">
                                <strong>Status Code:</strong> {test.errorDetails.response.status} {test.errorDetails.response.statusText}
                              </Typography>

                              {test.errorDetails.response.data && (
                                <Box mt={1}>
                                  <Typography variant="caption">Response Data:</Typography>
                                  <pre style={{
                                    backgroundColor: '#fff0f0',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    overflow: 'auto',
                                    maxHeight: '150px'
                                  }}>
                                    {JSON.stringify(test.errorDetails.response.data, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </Box>
                          )}

                          {!test.errorDetails.response && test.errorDetails.request && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              {test.errorDetails.request}
                            </Alert>
                          )}

                          {test.errorDetails.stack && (
                            <Box mt={1}>
                              <Typography variant="caption">Stack Trace:</Typography>
                              <pre style={{
                                backgroundColor: '#f5f5f5',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                overflow: 'auto',
                                maxHeight: '100px'
                              }}>
                                {test.errorDetails.stack}
                              </pre>
                            </Box>
                          )}

                          {/* Add diagnostic section for error responses */}
                          {test.data && test.data.debug_info && (
                            <Box mt={2}>
                              <Typography variant="subtitle2" color="secondary">
                                Extended API Diagnostics
                              </Typography>
                              <Accordion defaultExpanded={true}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography variant="subtitle2">API Configuration & Request Details</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <pre style={{
                                    backgroundColor: '#f8f8f8',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    overflow: 'auto',
                                    maxHeight: '400px'
                                  }}>
                                    {JSON.stringify(test.data.debug_info, null, 2)}
                                  </pre>
                                </AccordionDetails>
                              </Accordion>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      
      <Box sx={{ mt: 3, borderTop: '1px solid #ddd', pt: 2 }}>
        <Typography variant="subtitle2">Notes:</Typography>
        <Typography variant="body2">
          • This tester uses our backend server to communicate with the Instacart API
        </Typography>
        <Typography variant="body2">
          • You won't see CORS errors because all requests go through our server
        </Typography>
        <Typography variant="body2">
          • If you see 404 errors, it likely means the backend API endpoints are not implemented yet
        </Typography>
        <Typography variant="body2">
          • The Instacart API key must be properly configured on the backend server with format:
          <code style={{ backgroundColor: '#f5f5f5', padding: '0 4px', marginLeft: '4px' }}>
            InstacartAPI YOUR_API_KEY
          </code>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>Required Backend Endpoints:</strong>
        </Typography>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>/instacart/status - To check API connection status (now with extended diagnostics)</li>
          <li>/instacart/retailers - To get retailer data</li>
          <li>/instacart/key-info - To get API key information (now includes full API details)</li>
        </ul>
        <Typography variant="body2" color="primary.main" sx={{ mt: 1, fontWeight: 'bold' }}>
          Note: The diagnostics now show the actual API key and request details for debugging purposes.
          This is extremely valuable for troubleshooting but should be removed in production.
        </Typography>
      </Box>
    </Paper>
  );
};

export default InstacartSimpleTester;