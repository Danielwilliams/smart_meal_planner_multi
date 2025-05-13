/**
 * Fix for the polling error (405 Method Not Allowed) issue with shopping list API
 * 
 * This patch modifies the shopping list polling mechanism to handle 405 errors
 * and continue processing the shopping list with available data.
 */

// Apply this fix to the appropriate shopping list generation function
export function fixShoppingListPolling(apiService) {
  // The implementation is already in place now - we're just applying additional configuration
  // Log this to help with debugging
  
  // Override with patched implementation
  apiService.pollForShoppingListResults = async function(menuId, maxAttempts = 20, intervalMs = 2000) {
    let attempts = 0;
    
    // Use the initial response if polling fails
    const initialResponse = this.lastShoppingListResponse || null;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for results (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        const response = await fetch(`${this.apiUrl}/menu/${menuId}/shopping-list/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Handle 405 Method Not Allowed error
        if (response.status === 405) {
          console.log('Polling endpoint returned 405 Method Not Allowed, using initial response');
          // If we have an initial response, use it instead of failing
          if (initialResponse) {
            console.log('Using initial response as final response');
            return initialResponse;
          }
          throw new Error('Polling endpoint not available (405) and no initial response available');
        }
        
        if (!response.ok) {
          throw new Error(`Polling error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'completed') {
          console.log('Polling complete, received final data');
          return data;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Error during polling:', error.message);
        // If we've tried a few times and have an initial response, use it
        if (attempts >= 3 && initialResponse) {
          console.log('Polling failed, using initial response instead');
          return initialResponse;
        }
        
        // Otherwise wait and retry
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    // If polling times out but we have an initial response, use it
    if (initialResponse) {
      console.log('Polling timed out, using initial response instead');
      return initialResponse;
    }
    
    throw new Error('Polling timed out without receiving completed status');
  };
  
  console.log('Applied shopping list polling fix');
  return apiService;
}

export default { fixShoppingListPolling };