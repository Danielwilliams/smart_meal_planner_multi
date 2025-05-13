// Complete replacement of the generateNewAiList function
// Copy this entire function and replace the existing one in ShoppingListPage.jsx

// Generate a brand new AI shopping list from scratch
const generateNewAiList = async () => {
  // Reset state
  setGenerationLogs([]);
  setGenerationStats(null);
  setAiShoppingLoading(true);
  const startTime = new Date();

  // Helper to add logs with timestamps
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AI List] ${timestamp} - ${message}`);
    setGenerationLogs(prev => [...prev, { timestamp, message, type }]);
  };

  try {
    addLog(`Starting new AI shopping list generation for menu ID: ${selectedMenuId}`);

    // Step 1: Clear the cache
    addLog('Clearing shopping list cache...');
    try {
      // Use POST with a specific flag instead of DELETE to avoid 405 errors
      const clearResponse = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/ai-shopping-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menu_id: parseInt(selectedMenuId),
          use_cache: false,  // Force fresh generation
          use_ai: false      // Just clear cache, don't generate
        })
      });

      if (clearResponse.ok) {
        addLog('Cache cleared successfully', 'success');
      } else {
        addLog(`Cache clearing returned status: ${clearResponse.status}`, 'warning');
      }
    } catch (cacheError) {
      addLog(`Cache clearing error: ${cacheError.message}`, 'error');
      // Continue anyway
    }

    // Step 2: Generate a new shopping list using POST with enhanced OpenAI prompt
    addLog('Generating new AI shopping list...');
    addLog('Requesting AI categorization for better organization', 'info');
    
    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/ai-shopping-list`, {
      method: 'POST',  // Using POST to avoid Method Not Allowed error
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menu_id: parseInt(selectedMenuId),
        use_ai: true,
        use_cache: false,  // Force fresh generation
        additional_preferences: `
Please format each item as "Item: Quantity-Unit" and categorize into store sections.
Include healthy alternatives (e.g., "substitute Sour Cream for Non Fat Plain Greek Yogurt").
Group items into distinct categories like PRODUCE, MEAT/PROTEIN, DAIRY, BAKERY, GRAINS, CANNED GOODS, FROZEN, etc.
For each item, suggest the best aisle or section in a typical grocery store.
Also include helpful shopping tips.
`
      })
    });

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
                const nextResult = await pollForResult();
                resolve(nextResult);
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

    // Calculate stats
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;

    // Update state - first clear old data then set new data
    // First clear to force UI refresh
    setAiShoppingData(null);

    // Add a slight delay to ensure the UI updates
    setTimeout(() => {
      // Update state with the processed result
      console.log('FINAL DATA BEING SET IN UI:', processedResult);
      setAiShoppingData(processedResult);
      addLog('Updated UI with new shopping list data', 'success');

      // Also update the cache with the fresh data
      try {
        localStorage.setItem(
          `${AI_SHOPPING_CACHE_KEY}_${selectedMenuId}`,
          JSON.stringify({
            ...processedResult,
            cache_time: new Date().toISOString()
          })
        );
        addLog('Updated local cache with new data', 'info');
      } catch (cacheError) {
        addLog(`Error updating cache: ${cacheError.message}`, 'warning');
      }
    }, 100);

    setGenerationStats({
      startTime,
      endTime,
      duration: durationSeconds,
      success: true,
      responseSize: JSON.stringify(processedResult).length
    });

    addLog(`Generation completed in ${durationSeconds.toFixed(2)} seconds`, 'success');
    showSnackbar('New AI shopping list generated successfully');

  } catch (error) {
    addLog(`Error: ${error.message}`, 'error');

    // Update stats with error
    const endTime = new Date();
    setGenerationStats({
      startTime,
      endTime,
      duration: (endTime - startTime) / 1000,
      success: false,
      error: error.message
    });

    showSnackbar(`Error: ${error.message}`);
  } finally {
    setAiShoppingLoading(false);
  }
};