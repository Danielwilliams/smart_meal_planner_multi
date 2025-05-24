// Code snippet for handleRegenerateList function
// Add this to ShoppingListPage.jsx
const handleRegenerateList = async () => {
  try {
    if (!selectedMenuId) {
      showSnackbar("No menu selected");
      return;
    }

    // Set loading state
    setAiShoppingLoading(true);
    setActiveTab(1); // Switch to AI tab
    setLoadingMessageIndex(0); // Reset loading message index

    // Clear any cached AI data for this menu
    try {
      await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/ai-shopping-cache`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log("Successfully cleared AI shopping list cache");
    } catch (err) {
      console.error("Error clearing AI shopping list cache:", err);
      // Continue anyway
    }

    // Then make a new fetch request with use_cache=false
    const token = localStorage.getItem('token');
    if (!token) {
      console.error("No auth token in localStorage!");
      setAiShoppingLoading(false);
      showSnackbar("Authentication error");
      return;
    }

    console.log("Making API request for new AI shopping list:", selectedMenuId);
    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/ai-shopping-list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menu_id: parseInt(selectedMenuId),
        use_ai: true,
        use_cache: false
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result && (result.status === "processing" || !result.status)) {
      // Start polling for the final result
      console.log("AI shopping list processing started, beginning status polling");
      pollForAiShoppingListStatus(selectedMenuId);
    } else {
      // If we got an immediate result, use it
      console.log("Received immediate AI shopping list result:", result);
      setAiShoppingData(result);
      setAiShoppingLoading(false);
      showSnackbar("Shopping list regenerated successfully");
    }
  } catch (error) {
    console.error("Error regenerating AI shopping list:", error);
    setAiShoppingLoading(false);
    showSnackbar("Error regenerating shopping list");
    
    // Try the client-side fallback
    try {
      console.log("Attempting client-side fallback processing");
      const aiResult = processShoppingListAI(groceryList);
      setAiShoppingData(aiResult);
      showSnackbar("Generated shopping list using local processing");
    } catch (fallbackError) {
      console.error("Client-side fallback also failed:", fallbackError);
    }
  }
};

// Code snippet for updated ShoppingList component rendering for AI tab
// Replace the existing ShoppingList component in the AI tab with this:
{aiShoppingData && aiShoppingData.groceryList && (
  <ShoppingList
    categories={aiShoppingData.groceryList}
    selectedStore={selectedStore}
    onAddToCart={handleAddToCart}
    onAddToMixedCart={handleAddToMixedCart}
    healthyAlternatives={aiShoppingData.healthyAlternatives || []}
    shoppingTips={aiShoppingData.shoppingTips || []}
    onRegenerateList={handleRegenerateList}
  />
)}

// Make sure to include the imports needed:
// import { processShoppingListAI } from '../utils/aiShoppingListFix';