/**
 * Instacart API Browser Tester
 *
 * This script can be pasted directly into your browser console to test 
 * the Instacart API endpoints without requiring Node.js.
 *
 * Copy this entire script and paste it into your browser's developer console
 * while on the Smart Meal Planner website.
 */

(async function runInstacartApiTests() {
  // Create a simple logger that formats console output
  const logger = {
    log: (message) => console.log(`%c${message}`, 'color: black'),
    success: (message) => console.log(`%c✅ ${message}`, 'color: green; font-weight: bold'),
    error: (message) => console.log(`%c❌ ${message}`, 'color: red; font-weight: bold'),
    warn: (message) => console.log(`%c⚠️ ${message}`, 'color: orange; font-weight: bold'),
    info: (message) => console.log(`%c🔍 ${message}`, 'color: blue; font-weight: bold'),
    highlight: (message) => console.log(`%c${message}`, 'color: purple; font-weight: bold; background: #f0f0f0; padding: 2px 5px; border-radius: 3px')
  };

  // Helper to format JSON for display
  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (err) {
      return "[Error formatting JSON]";
    }
  };

  // Test configuration
  const config = {
    // Test both direct backend access and through Vercel proxy
    endpoints: [
      // Backend direct endpoints
      { 
        name: 'Backend: API Status', 
        url: 'https://smartmealplannermulti-development.up.railway.app/instacart/status',
        description: 'Checks if the Instacart API is properly configured and accessible (direct to backend)'
      },
      { 
        name: 'Backend: API Key Info', 
        url: 'https://smartmealplannermulti-development.up.railway.app/instacart/key-info',
        description: 'Gets detailed API key information (direct to backend)'
      },
      { 
        name: 'Backend: Get Retailers', 
        url: 'https://smartmealplannermulti-development.up.railway.app/instacart/retailers',
        description: 'Gets a list of available retailers on Instacart (direct to backend)'
      },
      // Vercel proxy endpoints
      { 
        name: 'Vercel Proxy: API Status', 
        url: '/api/instacart/status',
        description: 'Checks if the Instacart API is properly configured and accessible (via Vercel proxy)'
      },
      { 
        name: 'Vercel Proxy: API Key Info', 
        url: '/api/instacart/key-info',
        description: 'Gets detailed API key information (via Vercel proxy)'
      },
      { 
        name: 'Vercel Proxy: Get Retailers', 
        url: '/api/instacart/retailers',
        description: 'Gets a list of available retailers on Instacart (via Vercel proxy)'
      }
    ]
  };

  // Test a single endpoint
  async function testEndpoint(endpoint) {
    logger.highlight(`\nTesting: ${endpoint.name}`);
    logger.log(`URL: ${endpoint.url}`);
    logger.log(`Description: ${endpoint.description}`);
    
    try {
      const startTime = Date.now();
      
      // Make the fetch request
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const duration = Date.now() - startTime;
      logger.log(`Response time: ${duration}ms`);
      logger.log(`Status code: ${response.status} ${response.statusText}`);
      
      // Check if response is OK
      if (response.ok) {
        logger.success("Endpoint is available");
        
        // Try to parse as JSON
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            logger.info(`Response (JSON):`);
            console.log(data); // Log the full object for inspection
            
            const preview = formatJson(data).substring(0, 500);
            logger.log(`Preview: ${preview}${preview.length >= 500 ? '...' : ''}`);
            
            return {
              success: true,
              status: response.status,
              contentType,
              data,
              duration
            };
          } else {
            // Not JSON, get as text
            const text = await response.text();
            logger.warn(`Response is not JSON (Content-Type: ${contentType})`);
            logger.log(`Preview: ${text.substring(0, 500)}${text.length >= 500 ? '...' : ''}`);
            
            return {
              success: true,
              status: response.status,
              contentType,
              text: text.substring(0, 1000),
              duration
            };
          }
        } catch (parseError) {
          logger.error(`Error parsing response: ${parseError.message}`);
          const text = await response.text();
          logger.log(`Raw response: ${text.substring(0, 500)}${text.length >= 500 ? '...' : ''}`);
          
          return {
            success: false,
            status: response.status,
            parseError: parseError.message,
            text: text.substring(0, 1000),
            duration
          };
        }
      } else {
        logger.error(`Endpoint returned error status ${response.status}`);
        
        // Try to get error details
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            logger.info("Error details (JSON):");
            console.log(errorData);
            
            return {
              success: false,
              status: response.status,
              contentType,
              errorData,
              duration
            };
          } else {
            const text = await response.text();
            logger.info("Error details (Text):");
            logger.log(`${text.substring(0, 500)}${text.length >= 500 ? '...' : ''}`);
            
            return {
              success: false,
              status: response.status,
              contentType,
              errorText: text.substring(0, 1000),
              duration
            };
          }
        } catch (parseError) {
          logger.error(`Error parsing error response: ${parseError.message}`);
          return {
            success: false,
            status: response.status,
            parseError: parseError.message,
            duration
          };
        }
      }
    } catch (error) {
      logger.error(`Failed to connect to endpoint: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Run all tests
  async function runAllTests() {
    logger.highlight("========================================");
    logger.highlight("🔄 INSTACART API BROWSER TESTER");
    logger.highlight("========================================");
    logger.log(`Test time: ${new Date().toLocaleString()}`);
    
    const results = [];
    
    for (const endpoint of config.endpoints) {
      const result = await testEndpoint(endpoint);
      results.push({
        endpoint,
        result
      });
    }
    
    // Print summary
    logger.highlight("\n========================================");
    logger.highlight("📊 TEST SUMMARY");
    logger.highlight("========================================");
    
    const successCount = results.filter(r => r.result.success).length;
    logger.log(`Successful: ${successCount}/${config.endpoints.length}`);
    logger.log(`Failed: ${config.endpoints.length - successCount}/${config.endpoints.length}`);
    
    // Group by backend vs proxy
    const backendResults = results.filter(r => r.endpoint.name.startsWith('Backend:'));
    const proxyResults = results.filter(r => r.endpoint.name.startsWith('Vercel Proxy:'));
    
    const backendSuccess = backendResults.filter(r => r.result.success).length;
    const proxySuccess = proxyResults.filter(r => r.result.success).length;
    
    logger.log(`Backend direct endpoints: ${backendSuccess}/${backendResults.length} successful`);
    logger.log(`Vercel proxy endpoints: ${proxySuccess}/${proxyResults.length} successful`);
    
    if (backendSuccess > 0 && proxySuccess === 0) {
      logger.warn("\nThe backend endpoints are accessible directly, but not through the Vercel proxy.");
      logger.warn("This suggests an issue with the Vercel routing configuration or CORS settings.");
    } else if (backendSuccess === 0 && proxySuccess === 0) {
      logger.error("\nAll endpoints failed. The backend server might be down or the Instacart API endpoints are not implemented.");
    } else if (backendSuccess === 0 && proxySuccess > 0) {
      logger.warn("\nStrange result: The proxy endpoints work but direct backend access fails.");
      logger.warn("This might indicate network restrictions or CORS issues.");
    }
    
    return {
      results,
      summary: {
        total: config.endpoints.length,
        success: successCount,
        failed: config.endpoints.length - successCount,
        backend: {
          total: backendResults.length,
          success: backendSuccess
        },
        proxy: {
          total: proxyResults.length,
          success: proxySuccess
        }
      }
    };
  }

  // Run the tests
  try {
    const testResults = await runAllTests();
    logger.highlight("\n========================================");
    logger.success("✅ Test run completed");
    logger.highlight("========================================");
    
    // Store results in a global variable for further inspection
    window.instacartApiTestResults = testResults;
    logger.info("Full test results stored in window.instacartApiTestResults");
    
    return testResults;
  } catch (error) {
    logger.error(`Test run failed: ${error.message}`);
    console.error(error);
  }
})();