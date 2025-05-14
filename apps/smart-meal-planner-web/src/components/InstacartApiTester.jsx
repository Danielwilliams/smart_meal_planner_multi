import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import instacartService from '../services/instacartService';
import instacartDevTools from '../services/instacartDevTools';

/**
 * Debug component for testing Instacart API connectivity
 * This is only for development use and should not be exposed in production
 */
const InstacartApiTester = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [configResults, setConfigResults] = useState(null);
  const [zipCode, setZipCode] = useState('');
  const [expanded, setExpanded] = useState('panel1');
  const INSTACART_DEV_URL = 'https://smartmealplannermulti-development.up.railway.app';

  const handleChange = (panel) => (event, newExpanded) => {
    setExpanded(newExpanded ? panel : false);
  };

  const testApiKeyConfiguration = async () => {
    try {
      setLoading(true);
      setError('');
      setConfigResults(null);

      // Test the API key configuration
      const configTest = await instacartDevTools.testApiKeyConfig(INSTACART_DEV_URL);
      console.log('API Key configuration test results:', configTest);

      // Check if specific endpoints exist
      const endpointsToTest = [
        '/instacart/retailers',
        '/instacart/retailers/nearby',
        '/instacart/config/test',
        '/instacart/environment'
      ];

      const endpointResults = await Promise.all(
        endpointsToTest.map(endpoint =>
          instacartDevTools.checkEndpointExists(INSTACART_DEV_URL, endpoint)
        )
      );

      // Get environment info
      let envInfo = { success: false, error: 'Not attempted' };
      try {
        envInfo = await instacartDevTools.getApiEnvironmentInfo(INSTACART_DEV_URL);
      } catch (envErr) {
        console.error('Error getting environment info:', envErr);
        envInfo = { success: false, error: envErr.message };
      }

      // Format results
      setConfigResults({
        apiKeyTest: configTest,
        endpoints: endpointResults.map((result, index) => ({
          endpoint: endpointsToTest[index],
          ...result
        })),
        environment: envInfo,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error('Error testing API configuration:', err);
      setError(`Configuration test error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runConnectionTest = async () => {
    setLoading(true);
    setError('');
    setTestResults(null);
    
    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: []
      };
      
      // Test 1: Get all retailers (no ZIP code required)
      try {
        console.log('Testing getRetailers()...');
        const retailers = await instacartService.getRetailers();
        results.tests.push({
          name: 'Get All Retailers',
          success: true,
          data: {
            count: retailers.length,
            sample: retailers.slice(0, 3)
          }
        });
      } catch (err) {
        results.tests.push({
          name: 'Get All Retailers',
          success: false,
          error: err.message,
          details: err.response ? 
            {
              status: err.response.status,
              data: err.response.data
            } : 'Network Error'
        });
      }
      
      // Only run ZIP code tests if a ZIP code was provided
      if (zipCode) {
        // Test 2: Get nearby retailers by ZIP code
        try {
          console.log(`Testing getNearbyRetailers(${zipCode})...`);
          const nearbyRetailers = await instacartService.getNearbyRetailers(zipCode);
          results.tests.push({
            name: 'Get Nearby Retailers',
            success: true,
            data: {
              count: nearbyRetailers.length,
              sample: nearbyRetailers.slice(0, 3)
            }
          });
          
          // If we got retailers, test searching for a product
          if (nearbyRetailers.length > 0) {
            const retailerId = nearbyRetailers[0].id;
            
            // Test 3: Search for a product
            try {
              console.log(`Testing searchProducts(${retailerId}, "milk")...`);
              const products = await instacartService.searchProducts(retailerId, 'milk', 5);
              results.tests.push({
                name: 'Search Products',
                success: true,
                data: {
                  count: products.length,
                  sample: products.slice(0, 2)
                }
              });
            } catch (err) {
              results.tests.push({
                name: 'Search Products',
                success: false,
                error: err.message,
                details: err.response ? 
                  {
                    status: err.response.status,
                    data: err.response.data
                  } : 'Network Error'
              });
            }
          }
        } catch (err) {
          results.tests.push({
            name: 'Get Nearby Retailers',
            success: false,
            error: err.message,
            details: err.response ? 
              {
                status: err.response.status,
                data: err.response.data
              } : 'Network Error'
          });
        }
      }
      
      // Calculate overall success
      const successCount = results.tests.filter(test => test.success).length;
      results.overallStatus = successCount === results.tests.length ? 'success' : 
                             successCount > 0 ? 'partial' : 'failure';
      
      // Set the results
      setTestResults(results);
    } catch (err) {
      setError(`Failed to run tests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Paper elevation={2} sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 4 }}>
      <Typography variant="h5" gutterBottom>
        Instacart API Connection Tester
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        This tool tests the connection to the Instacart API to help identify any configuration issues.
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={testApiKeyConfiguration}
          disabled={loading}
          sx={{ mr: 2 }}
        >
          {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Test API Key Configuration
        </Button>

        <TextField
          label="ZIP Code (optional)"
          variant="outlined"
          size="small"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          placeholder="e.g. 10001"
          sx={{ mr: 2, width: 150 }}
        />
        <Button
          variant="contained"
          onClick={runConnectionTest}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Test API Connections
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {configResults && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>API Configuration Test Results</Typography>

          <Alert
            severity={configResults.apiKeyTest.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
          >
            {configResults.apiKeyTest.success ?
              'API key configuration test passed!' :
              `API key configuration test failed: ${configResults.apiKeyTest.error || 'Unknown error'}`}
          </Alert>

          <Typography variant="subtitle2" gutterBottom>Environment Information:</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 200, overflow: 'auto' }}>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(configResults.environment, null, 2)}
            </pre>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>Endpoint Availability:</Typography>
          <Box sx={{ mb: 2 }}>
            {configResults.endpoints.map((endpoint, i) => (
              <Alert
                key={i}
                severity={endpoint.success ? (endpoint.exists ? 'success' : 'warning') : 'error'}
                sx={{ mb: 1 }}
                icon={false}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    <strong>{endpoint.endpoint}</strong>: {' '}
                    {endpoint.success ?
                      (endpoint.exists ? 'Available' : 'Not found (404)') :
                      `Error: ${endpoint.error || 'Unknown error'}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Status: {endpoint.status || 'N/A'}
                  </Typography>
                </Box>
              </Alert>
            ))}
          </Box>
        </Box>
      )}

      {testResults && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>API Connection Test Results</Typography>

          <Alert
            severity={
              testResults.overallStatus === 'success' ? 'success' :
              testResults.overallStatus === 'partial' ? 'warning' : 'error'
            }
            sx={{ mb: 2 }}
          >
            {testResults.overallStatus === 'success' ?
              'All tests passed! The Instacart API connection is working properly.' :
              testResults.overallStatus === 'partial' ?
              'Some tests passed, but others failed. Check the details below.' :
              'All tests failed. There appears to be an issue with the Instacart API connection.'}
          </Alert>
          
          <Typography variant="subtitle2" gutterBottom>
            Tests run at: {new Date(testResults.timestamp).toLocaleString()}
          </Typography>
          
          {testResults.tests.map((test, index) => (
            <Accordion
              key={index}
              expanded={expanded === `panel${index + 1}`}
              onChange={handleChange(`panel${index + 1}`)}
              sx={{ mt: 1 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: test.success ? 'success.light' : 'error.light',
                  '&:hover': {
                    backgroundColor: test.success ? 'success.main' : 'error.main',
                  }
                }}
              >
                <Typography>
                  {test.name}: {test.success ? 'Success' : 'Failed'}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {test.success ? (
                  <Box>
                    <Typography variant="subtitle2">Result Summary:</Typography>
                    <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                      {JSON.stringify(test.data, null, 2)}
                    </pre>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="subtitle2" color="error">Error:</Typography>
                    <Typography>{test.error}</Typography>
                    
                    {test.details && typeof test.details !== 'string' && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 2 }}>Details:</Typography>
                        <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                          {JSON.stringify(test.details, null, 2)}
                        </pre>
                      </>
                    )}
                    
                    {test.details && typeof test.details === 'string' && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        {test.details}
                      </Alert>
                    )}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
      
      <Box sx={{ mt: 3, borderTop: '1px solid #ddd', pt: 2 }}>
        <Typography variant="subtitle2">Troubleshooting Tips:</Typography>
        <ul>
          <li>If you see API key errors, check that the INSTACARTAPI_DEV environment variable is set correctly in Railway</li>
          <li>For CORS errors, verify that the backend is properly configured to allow cross-origin requests</li>
          <li>Network errors could indicate that the backend service is down or unreachable</li>
          <li>If only the ZIP code-related tests fail, the nearby retailers endpoint may not be implemented yet</li>
        </ul>
      </Box>
    </Paper>
  );
};

export default InstacartApiTester;