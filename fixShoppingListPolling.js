// Copy this entire replacement code section into generateNewAiList function
// between "if (!response.ok)" and "// Calculate stats" 

if (!response.ok) {
  const errorText = await response.text();
  addLog(`API error: ${response.status} - ${errorText}`, 'error');
  throw new Error(`API error ${response.status}: ${errorText}`);
}

const initialResult = await response.json();
addLog('Received initial response from API', 'success');

// Log the entire response structure to debug
addLog(`Response keys: ${Object.keys(initialResult).join(', ')}`, 'info');
console.log("DEBUG Initial Response:", initialResult);

// Log the raw data in a more readable format
addLog(`Raw data: ${JSON.stringify(initialResult).substring(0, 500)}...`, 'info');

let finalResult = initialResult;

// Check if we need to poll for the final result
if (initialResult.status === 'processing') {
  addLog('AI processing in progress - starting to poll for results', 'info');
  
  // Begin polling for the completed AI result
  let pollCount = 0;
  const maxPolls = 20; // Maximum number of polling attempts
  const pollInterval = 2000; // Poll every 2 seconds
  
  // Function to poll for status
  const pollForResult = async () => {
    if (pollCount >= maxPolls) {
      addLog('Reached maximum polling attempts - giving up', 'warning');
      return initialResult;
    }
    
    pollCount++;
    addLog(`Polling for results (attempt ${pollCount}/${maxPolls})...`, 'info');
    
    try {
      const pollResponse = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/ai-shopping-list`, {
        method: 'GET',  // Use GET for status check
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!pollResponse.ok) {
        addLog(`Polling error: ${pollResponse.status}`, 'error');
        return null;
      }
      
      const pollResult = await pollResponse.json();
      
      // Check if processing is complete
      if (pollResult.status === 'completed' || pollResult.status === 'error' || 
          (pollResult.groceryList && pollResult.groceryList.length > 0)) {
        addLog('Processing complete! Final results received', 'success');
        return pollResult;
      } else {
        // Still processing, continue polling
        addLog(`Still processing: ${pollResult.status || 'unknown status'}`, 'info');
        return new Promise(resolve => {
          setTimeout(async () => {
            const result = await pollForResult();
            resolve(result);
          }, pollInterval);
        });
      }
    } catch (pollError) {
      addLog(`Polling error: ${pollError.message}`, 'error');
      return null;
    }
  };
  
  // Start polling and wait for the final result
  const polledResult = await pollForResult();
  if (polledResult) {
    finalResult = polledResult;
    addLog('Final response received', 'success');
    addLog(`Final data structure: ${Object.keys(finalResult).join(', ')}`, 'info');
  }
}

// Process the final result
let processedResult = adaptShoppingListResponse(finalResult, selectedMenuId, addLog);
console.log("PROCESSED DATA:", processedResult);

// Log a summary of what was generated
try {
  // Log categories and counts
  if (processedResult.categories && typeof processedResult.categories === 'object') {
    const categoryCounts = Object.keys(processedResult.categories).map(category =>
      `${category}: ${processedResult.categories[category].length} items`
    );
    addLog(`Generated categories: ${categoryCounts.join(', ')}`, 'info');
  }
  
  // Log healthy alternatives if present
  if (processedResult.healthyAlternatives && processedResult.healthyAlternatives.length > 0) {
    addLog(`Found ${processedResult.healthyAlternatives.length} healthy alternatives`, 'info');
  }

  // Log first few items as a sample of what was generated
  if (processedResult.categories) {
    let sampleItems = [];
    for (const category in processedResult.categories) {
      if (processedResult.categories[category] && processedResult.categories[category].length > 0) {
        const items = processedResult.categories[category].slice(0, 2); // Take first 2 items from each category
        sampleItems = [...sampleItems, ...items];
        if (sampleItems.length >= 6) break; // Limit to 6 sample items total
      }
    }
    if (sampleItems.length > 0) {
      addLog(`Sample items: ${sampleItems.join(', ')}`, 'info');
    }
  }
} catch (logError) {
  addLog(`Error logging results: ${logError.message}`, 'error');
}