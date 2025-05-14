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
import instacartAuthService from '../services/instacartAuthService';
import instacartApiKeyTester from '../services/instacartApiKeyTester';
import axios from 'axios';

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
  const [apiKey, setApiKey] = useState('');
  const [directTestResults, setDirectTestResults] = useState(null);
  const [expanded, setExpanded] = useState('panel1');
  const [apiKeyTestResults, setApiKeyTestResults] = useState(null);
  const INSTACART_DEV_URL = 'https://smartmealplannermulti-development.up.railway.app';
  const INSTACART_CONNECT_URL = 'https://connect.dev.instacart.tools';

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

  // Test Direct Instacart Connect API
  const testDirectInstacartApi = async () => {
    setLoading(true);
    setError('');
    setDirectTestResults(null);

    try {
      const results = {
        timestamp: new Date().toISOString(),
        tests: []
      };

      // Get the API key to use
      const keyToUse = apiKey || 'INSTACARTAPI_DEV';
      const isCustomKey = !!apiKey;

      // Log key format details for diagnostics without revealing the actual key
      console.log(`Using API key: ${keyToUse.substring(0, 3)}...${keyToUse.length > 6 ? keyToUse.substring(keyToUse.length - 3) : ''}`);
      console.log(`Key length: ${keyToUse.length}, Custom key provided: ${isCustomKey}`);

      // Show authorization header format
      const authHeader = `InstacartAPI ${keyToUse}`;
      console.log(`Authorization header format: ${authHeader.substring(0, 15)}...`);

      // Add API key diagnostics to results
      results.apiKeyInfo = {
        length: keyToUse.length,
        isCustomKey,
        authHeader: `${authHeader.substring(0, 15)}...`,
        format: "InstacartAPI [KEY]"
      };

      // Test 1: Direct GET to /v1/retailers
      const zc = zipCode || '80538';
      try {
        console.log(`Testing direct Instacart API: ${INSTACART_CONNECT_URL}/v1/retailers...`);

        // Use params object for query parameters instead of URL string
        const response = await axios.get(`${INSTACART_CONNECT_URL}/v1/retailers`, {
          params: {
            postal_code: zc,
            country_code: 'US'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          timeout: 10000 // 10 second timeout
        });

        // Store the response format
        const responseFormat = {
          hasRetailersArray: !!response.data?.retailers,
          isArray: Array.isArray(response.data),
          rootKeys: Object.keys(response.data || {})
        };

        // Extract retailers based on response format
        let retailers = [];
        if (response.data?.retailers && Array.isArray(response.data.retailers)) {
          retailers = response.data.retailers;
        } else if (Array.isArray(response.data)) {
          retailers = response.data;
        }

        // Save successful API path for future reference
        localStorage.setItem('instacart_api_path', 'v1');
        localStorage.setItem('instacart_api_connected', 'true');
        localStorage.setItem('instacart_api_last_success', Date.now().toString());

        // Save API key format that worked
        localStorage.setItem('instacart_auth_header_format', 'InstacartAPI');

        results.tests.push({
          name: 'Direct Instacart API - Get Retailers',
          success: true,
          data: {
            status: response.status,
            count: retailers.length,
            sample: retailers.slice(0, 2),
            format: responseFormat
          }
        });

        // If we got retailers, test the product search endpoint
        if (retailers.length > 0) {
          const retailerId = retailers[0].id;

          try {
            console.log(`Testing direct Instacart API: ${INSTACART_CONNECT_URL}/v1/retailers/${retailerId}/products/search...`);

            const searchResponse = await axios.get(`${INSTACART_CONNECT_URL}/v1/retailers/${retailerId}/products/search`, {
              params: {
                query: 'milk',
                limit: 5
              },
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              timeout: 10000
            });

            // Check search response format
            const searchResponseFormat = {
              hasProductsArray: !!searchResponse.data?.products,
              isArray: Array.isArray(searchResponse.data),
              rootKeys: Object.keys(searchResponse.data || {})
            };

            // Extract products based on response format
            let products = [];
            if (searchResponse.data?.products && Array.isArray(searchResponse.data.products)) {
              products = searchResponse.data.products;
            } else if (Array.isArray(searchResponse.data)) {
              products = searchResponse.data;
            }

            results.tests.push({
              name: 'Direct Instacart API - Search Products',
              success: true,
              data: {
                status: searchResponse.status,
                count: products.length,
                sample: products.slice(0, 2),
                format: searchResponseFormat
              }
            });

            // Try to create a test cart
            try {
              console.log(`Testing direct Instacart API cart creation: ${INSTACART_CONNECT_URL}/v1/retailers/${retailerId}/carts...`);

              // First format the test cart item
              const testCartItems = [{
                product_id: products[0]?.id?.toString() || 'test_product_id',
                quantity: 1
              }];

              const cartResponse = await axios.post(`${INSTACART_CONNECT_URL}/v1/retailers/${retailerId}/carts`, {
                items: testCartItems
              }, {
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                timeout: 15000
              });

              // Check cart response format
              const cartResponseFormat = {
                hasCart: !!cartResponse.data?.cart,
                hasId: !!(cartResponse.data?.id || cartResponse.data?.cart?.id),
                rootKeys: Object.keys(cartResponse.data || {})
              };

              // Extract cart ID based on response format
              let cartId = null;
              if (cartResponse.data?.cart?.id) {
                cartId = cartResponse.data.cart.id;
              } else if (cartResponse.data?.id) {
                cartId = cartResponse.data.id;
              }

              results.tests.push({
                name: 'Direct Instacart API - Create Cart',
                success: !!cartId,
                data: {
                  status: cartResponse.status,
                  cartId: cartId,
                  format: cartResponseFormat,
                  sample: cartResponse.data
                }
              });
            } catch (cartErr) {
              results.tests.push({
                name: 'Direct Instacart API - Create Cart',
                success: false,
                error: cartErr.message,
                details: cartErr.response ?
                  {
                    status: cartErr.response.status,
                    data: cartErr.response.data
                  } : 'Network Error'
              });
            }
          } catch (searchErr) {
            results.tests.push({
              name: 'Direct Instacart API - Search Products',
              success: false,
              error: searchErr.message,
              details: searchErr.response ?
                {
                  status: searchErr.response.status,
                  data: searchErr.response.data
                } : 'Network Error'
            });
          }
        }
      } catch (err) {
        console.error('Primary API path failed:', err);

        // Store API error details
        localStorage.setItem('instacart_direct_api_error', JSON.stringify({
          message: err.message,
          status: err.response?.status || 'unknown',
          timestamp: Date.now()
        }));

        results.tests.push({
          name: 'Direct Instacart API - Get Retailers',
          success: false,
          error: err.message,
          details: err.response ?
            {
              status: err.response.status,
              data: err.response.data
            } : 'Network Error'
        });
      }

      // Test 2: Alternate API path (idp/v1)
      try {
        console.log(`Testing direct Instacart API alternate path: ${INSTACART_CONNECT_URL}/idp/v1/retailers...`);

        const response = await axios.get(`${INSTACART_CONNECT_URL}/idp/v1/retailers`, {
          params: {
            postal_code: zc,
            country_code: 'US'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          timeout: 10000
        });

        // Store the response format
        const responseFormat = {
          hasRetailersArray: !!response.data?.retailers,
          isArray: Array.isArray(response.data),
          rootKeys: Object.keys(response.data || {})
        };

        // Extract retailers based on response format
        let retailers = [];
        if (response.data?.retailers && Array.isArray(response.data.retailers)) {
          retailers = response.data.retailers;
        } else if (Array.isArray(response.data)) {
          retailers = response.data;
        }

        // If this works, save it as the preferred path
        if (retailers.length > 0) {
          localStorage.setItem('instacart_api_path', 'idp/v1');
          localStorage.setItem('instacart_api_connected', 'true');
          localStorage.setItem('instacart_api_last_success', Date.now().toString());
        }

        results.tests.push({
          name: 'Direct Instacart API (alt path) - Get Retailers',
          success: true,
          data: {
            status: response.status,
            count: retailers.length,
            sample: retailers.slice(0, 2),
            format: responseFormat
          }
        });

        // If alternate path works but main path failed,
        // update the instacartAuthService to use this path
        if (retailers.length > 0 && results.tests[0].success === false) {
          console.log('Alternate path works but main path failed - setting alternate as default');
          localStorage.setItem('instacart_api_path', 'idp/v1');
        }
      } catch (err) {
        console.error('Alternate API path failed:', err);

        results.tests.push({
          name: 'Direct Instacart API (alt path) - Get Retailers',
          success: false,
          error: err.message,
          details: err.response ?
            {
              status: err.response.status,
              data: err.response.data
            } : 'Network Error'
        });
      }

      // Test 3: Try our authService
      try {
        console.log(`Testing instacartAuthService.getNearbyRetailers(${zc})...`);
        // This will already try direct API first, then fall back to backend
        const retailers = await instacartAuthService.getNearbyRetailers(zc);

        results.tests.push({
          name: 'instacartAuthService - Get Nearby Retailers',
          success: true,
          data: {
            count: retailers.length,
            sample: retailers.slice(0, 2),
            fromMock: localStorage.getItem('instacart_using_mock_data') === 'true',
            fromDirectApi: localStorage.getItem('instacart_direct_api_success') === 'true'
          }
        });
      } catch (err) {
        results.tests.push({
          name: 'instacartAuthService - Get Nearby Retailers',
          success: false,
          error: err.message,
          details: localStorage.getItem('instacart_direct_api_error') || 'No error details available'
        });
      }

      // Calculate overall success
      const successCount = results.tests.filter(test => test.success).length;
      results.overallStatus = successCount === results.tests.length ? 'success' :
                             successCount > 0 ? 'partial' : 'failure';

      // Set the results
      setDirectTestResults(results);
    } catch (err) {
      setError(`Failed to run direct API tests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test API key specifically to verify correct header format
  const testApiKeyFormat = async () => {
    setLoading(true);
    setError('');
    setApiKeyTestResults(null);

    try {
      console.log('Testing API key format specifically...');

      // Get the API key to use
      const keyToUse = apiKey || 'INSTACARTAPI_DEV';
      console.log(`Using API key: ${keyToUse.substring(0, 3)}...${keyToUse.length > 6 ? keyToUse.substring(keyToUse.length - 3) : ''}`);

      // Use the API key tester to analyze different header formats
      const zc = zipCode || '80538';
      const results = await instacartApiKeyTester.testApiKey(keyToUse, zc);

      console.log('API key test results:', results);
      setApiKeyTestResults(results);

      // If a working format is found, store it in localStorage
      if (results.success && results.authHeader.workingFormat) {
        localStorage.setItem('instacart_auth_header_format', results.authHeader.workingFormat);
        localStorage.setItem('instacart_api_connected', 'true');
        localStorage.setItem('instacart_api_last_success', Date.now().toString());
      }
    } catch (err) {
      console.error('Error testing API key format:', err);
      setError(`Failed to test API key format: ${err.message}`);
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
        <Typography variant="h6" gutterBottom>
          1. Test Our Backend API Configuration
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={testApiKeyConfiguration}
          disabled={loading}
          sx={{ mr: 2, mb: 2 }}
        >
          {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Test API Key Configuration
        </Button>

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
          onClick={runConnectionTest}
          disabled={loading}
          sx={{ mb: 2 }}
        >
          {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Test Backend API Connections
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. Test Direct Instacart Connect API
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This will directly test the Instacart Connect API at <code>{INSTACART_CONNECT_URL}</code> using the API key to see if the connection works.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TextField
            label="Instacart API Key (optional)"
            variant="outlined"
            size="small"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API key or leave blank to use default"
            sx={{ mr: 2, flexGrow: 1 }}
          />

          <Button
            variant="contained"
            color="primary"
            onClick={testDirectInstacartApi}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
            Test Direct API
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={testApiKeyFormat}
            disabled={loading}
            title="Test specifically if the API key format is correct"
          >
            Test Key Format
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Note: If you leave the API key blank, the system default 'INSTACARTAPI_DEV' will be used. This might or might not be valid.
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* API Key Format Test Results */}
      {apiKeyTestResults && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>API Key Format Test Results</Typography>

          <Alert
            severity={apiKeyTestResults.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
          >
            {apiKeyTestResults.success
              ? `Success! The API key works with the "${apiKeyTestResults.authHeader.workingFormat}" format.`
              : `API key test failed: ${apiKeyTestResults.error || 'Unknown error'}`
            }
          </Alert>

          <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: '#f5f7ff' }}>
            <Typography variant="subtitle1" gutterBottom>
              API Key Details
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>API Key Length:</strong> {apiKeyTestResults.apiKey.length} characters
              </Typography>
              <Typography variant="body2">
                <strong>Masked Key:</strong> {apiKeyTestResults.apiKey.masked}
              </Typography>
            </Box>

            {apiKeyTestResults.success && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="success.main">
                  Recommended Authorization Header:
                </Typography>
                <Paper sx={{ p: 1, backgroundColor: '#f0fff0', mt: 1 }}>
                  <pre style={{ margin: 0 }}>
                    Authorization: {apiKeyTestResults.authHeader.exampleHeader}
                  </pre>
                </Paper>
              </Box>
            )}

            <Typography variant="subtitle2" gutterBottom>
              Header Format Test Results:
            </Typography>

            <Box sx={{ mb: 2 }}>
              {apiKeyTestResults.requests.map((req, index) => (
                <Alert
                  key={index}
                  severity={req.success ? 'success' : 'error'}
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2">
                        <strong>{req.format}:</strong> {req.success ? 'Works' : 'Failed'}
                      </Typography>
                      <Typography variant="caption" component="div">
                        Header: <code>{req.header}</code>
                      </Typography>
                    </Box>
                    <Box>
                      {req.status && (
                        <Chip
                          size="small"
                          label={`Status: ${req.status}`}
                          color={req.success ? 'success' : 'error'}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>

                  {!req.success && req.error && (
                    <Typography variant="caption" color="error.main">
                      Error: {req.error}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Box>

            {!apiKeyTestResults.success && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="error.main">
                  Troubleshooting Recommendations:
                </Typography>
                <ul style={{ marginTop: 5 }}>
                  <li>Make sure your API key is valid and not expired</li>
                  <li>The standard format for Instacart is: <code>Authorization: InstacartAPI YOUR_KEY</code></li>
                  <li>Check that your key has the necessary permissions</li>
                  <li>Verify your internet connection and that you can access {INSTACART_CONNECT_URL}</li>
                </ul>
              </Box>
            )}
          </Paper>
        </Box>
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

      {directTestResults && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Direct Instacart API Test Results</Typography>

          <Alert
            severity={
              directTestResults.overallStatus === 'success' ? 'success' :
              directTestResults.overallStatus === 'partial' ? 'warning' : 'error'
            }
            sx={{ mb: 2 }}
          >
            {directTestResults.overallStatus === 'success' ?
              'All direct API tests passed! You can connect directly to the Instacart API.' :
              directTestResults.overallStatus === 'partial' ?
              'Some direct API tests passed. You may be able to use the direct API for some operations.' :
              'All direct API tests failed. Direct access to Instacart API is not working.'}
          </Alert>

          {/* API Key Information Section */}
          {directTestResults.apiKeyInfo && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: '#f0f7ff' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                API Configuration Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>API Key Format:</strong> {directTestResults.apiKeyInfo.format}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Authorization Header:</strong> {directTestResults.apiKeyInfo.authHeader}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Key Length:</strong> {directTestResults.apiKeyInfo.length} characters
                  </Typography>
                  <Typography variant="body2">
                    <strong>Custom Key Used:</strong> {directTestResults.apiKeyInfo.isCustomKey ? 'Yes' : 'No (using default)'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="info" icon={false} sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      The Instacart API requires an <strong>Authorization header</strong> in the format: <code>Authorization: InstacartAPI YOUR_API_KEY</code>.
                      Make sure this exact format is used in all API requests.
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Paper>
          )}

          {directTestResults.tests.map((test, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography
                  variant="subtitle2"
                  color={test.success ? 'success.main' : 'error.main'}
                  sx={{ fontWeight: 'bold', mr: 1 }}
                >
                  {test.name}
                </Typography>
                <Chip
                  label={test.success ? 'Success' : 'Failed'}
                  color={test.success ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              {test.success ? (
                <Box>
                  {test.data && (
                    <>
                      {test.data.count !== undefined && (
                        <Typography variant="body2">
                          Found {test.data.count} items
                        </Typography>
                      )}

                      {test.data.format && (
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            <strong>Response Format:</strong>
                          </Typography>
                          <Box
                            sx={{
                              backgroundColor: '#f5f5f5',
                              p: 1,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              display: 'inline-block',
                              ml: 1
                            }}
                          >
                            {test.data.format.hasRetailersArray && "Has 'retailers' array"}
                            {test.data.format.hasProductsArray && "Has 'products' array"}
                            {test.data.format.hasCart && "Has 'cart' object"}
                            {test.data.format.hasId && "Has 'id' field"}
                            {test.data.format.isArray && "Response is an array"}
                            {test.data.format.rootKeys &&
                              <>Root keys: {test.data.format.rootKeys.join(', ')}</>
                            }
                          </Box>
                        </Box>
                      )}

                      {test.data.cartId && (
                        <Typography variant="body2" color="success.main">
                          <strong>Created cart with ID:</strong> {test.data.cartId}
                        </Typography>
                      )}

                      {test.data.sample && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Sample data:
                          </Typography>
                          <pre style={{
                            backgroundColor: '#f5f5f5',
                            p: 1,
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            overflowX: 'auto',
                            maxHeight: '200px'
                          }}>
                            {JSON.stringify(test.data.sample, null, 2)}
                          </pre>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="error">
                    Error: {test.error}
                  </Typography>
                  {test.details && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Error details:
                      </Typography>
                      <pre style={{
                        backgroundColor: '#f5f5f5',
                        p: 1,
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                        maxHeight: '200px'
                      }}>
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </Box>
                  )}
                  {test.name.includes('Get Retailers') && test.error && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        <strong>Troubleshooting tips:</strong><br/>
                        - Check that your API key is correct<br/>
                        - Ensure the authorization header format is exactly: <code>Authorization: InstacartAPI YOUR_API_KEY</code><br/>
                        - Verify that your API key has permissions for the Instacart Connect API<br/>
                        - Try both API paths (/v1 and /idp/v1)
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
            </Paper>
          ))}

          {/* Added troubleshooting section */}
          <Box sx={{ mt: 3, mb: 2 }}>
            <Typography variant="subtitle1">API Key Format Examples:</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" component="div">
                <strong>Correct format for Authorization header:</strong>
                <pre style={{ backgroundColor: '#f5f5f5', p: 1, borderRadius: 4, mt: 1 }}>
                  Authorization: InstacartAPI k_abc123def456...
                </pre>
                <strong>Common JavaScript implementation:</strong>
                <pre style={{ backgroundColor: '#f5f5f5', p: 1, borderRadius: 4, mt: 1 }}>
{`const response = await axios.get('https://connect.dev.instacart.tools/v1/retailers', {
  params: {
    postal_code: zipCode,
    country_code: 'US'
  },
  headers: {
    'Authorization': \`InstacartAPI \${apiKey}\`,
    'Content-Type': 'application/json'
  }
});`}
                </pre>
              </Typography>
            </Paper>
          </Box>
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