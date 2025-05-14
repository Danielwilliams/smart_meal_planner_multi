import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Grid
} from '@mui/material';
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

  const runApiTest = async () => {
    setLoading(true);
    setError('');
    setTestResults(null);

    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: []
      };

      // Test 1: Check API Status
      try {
        console.log('Checking Instacart API status...');
        const statusResponse = await instacartBackendService.checkInstacartStatus();
        
        results.tests.push({
          name: 'API Status Check',
          success: statusResponse.is_connected,
          data: statusResponse
        });
      } catch (statusErr) {
        results.tests.push({
          name: 'API Status Check',
          success: false,
          error: statusErr.message
        });
      }

      // Test 2: Get retailers by ZIP code
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
            results.tests.push({
              name: 'Search Products',
              success: false,
              error: searchErr.message
            });
          }
        }
      } catch (retailersErr) {
        results.tests.push({
          name: 'Get Retailers',
          success: false,
          error: retailersErr.message
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
                      )}
                    </Box>
                  ) : (
                    <Typography color="error.main">
                      Error: {test.error}
                    </Typography>
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
          • The backend server is configured with the proper API key and authentication
        </Typography>
      </Box>
    </Paper>
  );
};

export default InstacartSimpleTester;