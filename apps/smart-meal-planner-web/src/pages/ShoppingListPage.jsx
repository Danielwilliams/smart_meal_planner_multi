import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Box, 
  Paper, 
  Grid,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import StoreSelector from '../components/StoreSelector';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import CATEGORY_MAPPING from '../data/categoryMapping';
import ShoppingList from '../components/ShoppingList';
import { 
  AutoAwesome as AiIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingBasket as BasketIcon,
  TipsAndUpdates as TipsIcon,
  LocalOffer as OfferIcon,
  Kitchen as KitchenIcon,
  Category as CategoryIcon
} from '@mui/icons-material';

function ShoppingListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { menuId: urlMenuId } = useParams(); // Get menuId from URL path
  const [searchParams] = useSearchParams(); // Get query parameters
  
  // Check for menuId in various places
  const queryMenuId = searchParams.get('menuId');
  const isClientSourced = searchParams.get('source') === 'client';
  
  // State management
  const [groceryList, setGroceryList] = useState([]);
  const [menuHistory, setMenuHistory] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState(urlMenuId || queryMenuId || null);
  const [selectedStore, setSelectedStore] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeSearchResults, setStoreSearchResults] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // AI shopping list state
  const [showAiShoppingPrompt, setShowAiShoppingPrompt] = useState(false);
  const [aiShoppingLoading, setAiShoppingLoading] = useState(false);
  const [aiShoppingData, setAiShoppingData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [aiPreferences, setAiPreferences] = useState('');
  const [usingAiList, setUsingAiList] = useState(false);
  
  // Cache management
  const AI_SHOPPING_CACHE_KEY = 'ai_shopping_cache';
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Debug log
  console.log("ShoppingListPage params:", { 
    urlMenuId, 
    queryMenuId, 
    selectedMenuId, 
    isClientSourced 
  });
  
  // Helper function to format categories for display
  const formatCategoriesForDisplay = (groceryItems) => {
    // If already in expected format (object with category keys)
    if (!Array.isArray(groceryItems) && typeof groceryItems === 'object') {
      console.log('Grocery list already in category format:', groceryItems);
      return groceryItems;
    }
    
    // If empty or invalid
    if (!groceryItems || !Array.isArray(groceryItems) || groceryItems.length === 0) {
      console.log('Empty or invalid grocery items:', groceryItems);
      return {};
    }
    
    console.log('Formatting grocery items for display:', groceryItems);
    
    // Process the flat list into categories
    const categorized = {};
    
    groceryItems.forEach(item => {
      // Get the item name (handle both string and object formats)
      const itemName = typeof item === 'string' ? item : item.name || '';
      if (!itemName) return;
      
      // Determine category based on keywords
      const normalizedName = itemName.toLowerCase();
      const category = Object.keys(CATEGORY_MAPPING).find(cat => 
        CATEGORY_MAPPING[cat].some(keyword => 
          normalizedName.includes(keyword.toLowerCase())
        )
      ) || 'Other';
      
      // Create category array if it doesn't exist
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      // Add the item to its category
      categorized[category].push(itemName);
    });
    
    console.log('Categorized items for display:', categorized);
    return categorized;
  };

  // Check for new user flow from navigation state
  const { isNewUser, showWalkthrough } = location.state || {};

  // Fetch shopping list data
 const fetchShoppingListData = async () => {
  if (!user?.userId) {
    console.error('No user or userId found');
    navigate('/login');
    return;
  }

  try {
    setLoading(true);
    setError('');
    setGroceryList([]); // Reset grocery list to avoid showing old data

    // If we have a menuId from URL, use that directly
    if (selectedMenuId) {
      console.log(`Using menu ID from URL: ${selectedMenuId}`);
      
      // Try both endpoints to get the data we need
      let fetchedGroceryList = [];
      let menuDetails = null;
      let success = false;
      
      // Strategy 1: Try direct grocery list API
      try {
        console.log(`Strategy 1: Fetching grocery list for menu ${selectedMenuId}`);
        const groceryListResponse = await apiService.getGroceryListByMenuId(selectedMenuId);
        
        console.log("Raw grocery list response:", groceryListResponse);
        
        if (groceryListResponse && groceryListResponse.groceryList && groceryListResponse.groceryList.length > 0) {
          console.log("Grocery list fetched successfully:", groceryListResponse.groceryList);
          fetchedGroceryList = groceryListResponse.groceryList;
          success = true;
        } else if (groceryListResponse && Array.isArray(groceryListResponse)) {
          console.log("Grocery list returned as direct array:", groceryListResponse);
          fetchedGroceryList = groceryListResponse;
          success = true;
        }
      } catch (groceryErr) {
        console.log("Strategy 1 failed:", groceryErr.message);
      }
      
      // Strategy 2: If first attempt failed, try client menu endpoint
      if (!success) {
        try {
          console.log(`Strategy 2: Fetching client menu ${selectedMenuId}`);
          menuDetails = await apiService.getClientMenu(selectedMenuId);
          console.log("Client menu fetched successfully:", menuDetails);
          
          // Check if API returned a grocery list directly
          if (menuDetails && menuDetails.groceryList && menuDetails.groceryList.length > 0) {
            fetchedGroceryList = menuDetails.groceryList;
            success = true;
          }
          // Otherwise need to extract from menu plan
          else if (menuDetails && (menuDetails.meal_plan || menuDetails.meal_plan_json)) {
            console.log("Extracting grocery list from client menu meal plan");
            try {
              // Get client grocery list API if we have the menu
              const clientGroceryList = await apiService.getClientGroceryList(selectedMenuId);
              if (clientGroceryList && clientGroceryList.groceryList) {
                fetchedGroceryList = clientGroceryList.groceryList;
                success = true;
                console.log("Client grocery list API succeeded:", fetchedGroceryList);
              }
            } catch (clientGroceryErr) {
              console.log("Client grocery list API failed, falling back to extraction from meal plan");
              // Extract from menu details
              const categorizedItems = categorizeItems(menuDetails);
              fetchedGroceryList = Object.values(categorizedItems).flat();
              success = fetchedGroceryList.length > 0;
            }
          }
        } catch (clientMenuErr) {
          console.log("Strategy 2 failed:", clientMenuErr.message);
        }
      }
      
      // Strategy 3: Try regular menu endpoint
      if (!success) {
        try {
          console.log(`Strategy 3: Fetching regular menu ${selectedMenuId}`);
          menuDetails = await apiService.getMenuDetails(selectedMenuId);
          console.log("Regular menu fetched successfully:", menuDetails);
          
          // Extract from menu details
          const categorizedItems = categorizeItems(menuDetails);
          fetchedGroceryList = Object.values(categorizedItems).flat();
          success = fetchedGroceryList.length > 0;
        } catch (regularMenuErr) {
          console.log("Strategy 3 failed:", regularMenuErr.message);
        }
      }
      
      // Strategy 4: Manual extraction directly from meal_plan_json
      if (!success && menuDetails && menuDetails.meal_plan_json) {
        try {
          console.log(`Strategy 4: Manual extraction from meal_plan_json for menu ${selectedMenuId}`);
          
          // Parse meal_plan_json if it's a string
          let mealPlanData = menuDetails.meal_plan_json;
          if (typeof mealPlanData === 'string') {
            try {
              mealPlanData = JSON.parse(mealPlanData);
            } catch (e) {
              console.error("Failed to parse meal_plan_json:", e);
            }
          }
          
          console.log("Trying to extract ingredients from meal plan data:", mealPlanData);
          
          // Extract ingredients from the meal plan
          let allIngredients = [];
          
          // Handle menu structure with days array
          if (mealPlanData && mealPlanData.days && Array.isArray(mealPlanData.days)) {
            console.log(`Processing ${mealPlanData.days.length} days of meal data`);
            
            mealPlanData.days.forEach((day, dayIndex) => {
              console.log(`Processing day ${dayIndex + 1}`);
              
              // Process meals
              if (day.meals && Array.isArray(day.meals)) {
                day.meals.forEach((meal, mealIndex) => {
                  console.log(`Processing meal ${mealIndex + 1}: ${meal.title || 'Unnamed'}`);
                  
                  if (meal.ingredients && Array.isArray(meal.ingredients)) {
                    meal.ingredients.forEach(ing => {
                      let ingredientText = '';
                      if (typeof ing === 'string') {
                        ingredientText = ing;
                      } else {
                        // Try to construct from name and quantity
                        const name = ing.name || '';
                        const quantity = ing.quantity || ing.amount || '';
                        ingredientText = `${quantity} ${name}`.trim();
                      }
                      
                      if (ingredientText) {
                        allIngredients.push(ingredientText);
                      }
                    });
                  }
                });
              }
              
              // Process snacks
              if (day.snacks && Array.isArray(day.snacks)) {
                day.snacks.forEach((snack, snackIndex) => {
                  console.log(`Processing snack ${snackIndex + 1}: ${snack.title || 'Unnamed'}`);
                  
                  if (snack.ingredients && Array.isArray(snack.ingredients)) {
                    snack.ingredients.forEach(ing => {
                      let ingredientText = '';
                      if (typeof ing === 'string') {
                        ingredientText = ing;
                      } else {
                        // Try to construct from name and quantity
                        const name = ing.name || '';
                        const quantity = ing.quantity || ing.amount || '';
                        ingredientText = `${quantity} ${name}`.trim();
                      }
                      
                      if (ingredientText) {
                        allIngredients.push(ingredientText);
                      }
                    });
                  } else if (snack.title) {
                    // Handle snacks without ingredients array
                    const title = snack.title || '';
                    const quantity = snack.quantity || snack.amount || '';
                    const ingredientText = `${quantity} ${title}`.trim();
                    
                    if (ingredientText) {
                      allIngredients.push(ingredientText);
                    }
                  }
                });
              }
            });
          }
          
          // General deep scanning for any menu with missing ingredients
          if (allIngredients.length === 0) {
            console.log(`Using deep scan to find ingredients in any structure`);
            
            // Define deep scanning function for any menu
            const deepScanForIngredients = (obj, path = '') => {
              if (!obj || typeof obj !== 'object') return;
              
              if (Array.isArray(obj)) {
                // If array, check each element
                obj.forEach((item, idx) => {
                  deepScanForIngredients(item, `${path}[${idx}]`);
                });
                return;
              }
              
              // Log structure to help debugging
              console.log(`Scanning at path: ${path || 'root'}, keys: ${Object.keys(obj).join(', ')}`);
              
              // Look for ingredients arrays
              if ('ingredients' in obj && Array.isArray(obj.ingredients)) {
                console.log(`Found ingredients array at ${path} with ${obj.ingredients.length} items`);
                
                obj.ingredients.forEach((ing, idx) => {
                  if (typeof ing === 'string') {
                    console.log(`Found string ingredient: ${ing}`);
                    allIngredients.push(ing);
                  } else if (ing && typeof ing === 'object') {
                    const name = ing.name || '';
                    const quantity = ing.quantity || ing.amount || '';
                    
                    if (name) {
                      const ingredientText = `${quantity} ${name}`.trim();
                      console.log(`Found object ingredient: ${ingredientText}`);
                      allIngredients.push(ingredientText);
                    }
                  }
                });
              }
              
              // Look for title and quantity/amount (simple format)
              if (obj.title && !obj.ingredients) {
                const title = obj.title || '';
                const quantity = obj.quantity || obj.amount || '';
                
                if (title) {
                  const ingredientText = `${quantity} ${title}`.trim();
                  console.log(`Found simple item with title: ${ingredientText}`);
                  allIngredients.push(ingredientText);
                }
              }
              
              // Recursively scan all properties that are objects
              Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') {
                  deepScanForIngredients(obj[key], path ? `${path}.${key}` : key);
                }
              });
            };
            
            // Scan mealPlanData
            deepScanForIngredients(mealPlanData);
            
            // If that didn't work, try the entire menuDetails object
            if (allIngredients.length === 0 && menuDetails) {
              console.log(`No ingredients found in meal plan data, scanning full menuDetails`);
              deepScanForIngredients(menuDetails);
            }
            
            // Last resort: try to find days array in any nested location
            if (allIngredients.length === 0) {
              console.log("Last resort: looking for days array in any nested location");
              
              // Extract from any structure in the menu payload
              try {
                // Look for days array in nested objects
                const findDaysArray = (obj) => {
                  if (!obj) return null;
                  if (obj.days && Array.isArray(obj.days)) return obj.days;
                  
                  if (typeof obj === 'object') {
                    for (const key in obj) {
                      if (obj[key] && typeof obj[key] === 'object') {
                        const found = findDaysArray(obj[key]);
                        if (found) return found;
                      }
                    }
                  }
                  return null;
                };
                
                const days = findDaysArray(menuDetails);
                if (days) {
                  console.log(`Found days array with ${days.length} days`);
                  
                  // Process each day
                  days.forEach(day => {
                    // Process meals
                    if (day.meals && Array.isArray(day.meals)) {
                      day.meals.forEach(meal => {
                        // Extract from ingredients if available
                        if (meal.ingredients && Array.isArray(meal.ingredients)) {
                          meal.ingredients.forEach(ing => {
                            if (typeof ing === 'object' && ing.name) {
                              const ingredient = `${ing.quantity || ''} ${ing.name}`.trim();
                              allIngredients.push(ingredient);
                            } else if (typeof ing === 'string') {
                              allIngredients.push(ing);
                            }
                          });
                        }
                      });
                    }
                    
                    // Process snacks 
                    if (day.snacks && Array.isArray(day.snacks)) {
                      day.snacks.forEach(snack => {
                        if (typeof snack === 'object') {
                          // If it has a title but no ingredients, it might be a simple item
                          if (snack.title && !snack.ingredients) {
                            const ingredient = `${snack.quantity || ''} ${snack.title}`.trim();
                            allIngredients.push(ingredient);
                          } 
                          // If it has ingredients, process them
                          else if (snack.ingredients && Array.isArray(snack.ingredients)) {
                            snack.ingredients.forEach(ing => {
                              if (typeof ing === 'object' && ing.name) {
                                const ingredient = `${ing.quantity || ''} ${ing.name}`.trim();
                                allIngredients.push(ingredient);
                              } else if (typeof ing === 'string') {
                                allIngredients.push(ing);
                              }
                            });
                          }
                        }
                      });
                    }
                  });
                }
              } catch (e) {
                console.error("Last resort extraction failed:", e);
              }
            }
          }
          
          if (allIngredients.length > 0) {
            console.log("Manually extracted ingredients:", allIngredients);
            fetchedGroceryList = allIngredients;
            success = true;
          }
        } catch (extractionErr) {
          console.error("Strategy 4 manual extraction failed:", extractionErr);
        }
      }
      
      // If we got data from any strategy, use it
      if (success && fetchedGroceryList.length > 0) {
        console.log("Final grocery list:", fetchedGroceryList);
        setGroceryList(fetchedGroceryList);
      } else {
        console.error("All strategies failed or returned empty data");
        setError(`No grocery items found for menu ${selectedMenuId}. The menu might not have any ingredients.`);
      }
    } else {
      // No specific menu ID, get the latest one
      const history = await apiService.getMenuHistory(user.userId);
      setMenuHistory(history);

      if (history && history.length > 0) {
        const latestMenuId = history[0].menu_id;
        
        // Fetch the full menu details
        const fullMenuDetails = await apiService.getMenuDetails(latestMenuId);
        
        console.log('Full Menu Details:', fullMenuDetails);
        
        // Use the categorizeItems method to generate grocery list
        const categorizedItems = categorizeItems(fullMenuDetails);
        const groceryList = Object.values(categorizedItems).flat();
        
        console.log("🔎 Grocery List:", groceryList);

        if (groceryList.length > 0) {
          setGroceryList(groceryList);
          setSelectedMenuId(latestMenuId);
        } else {
          setError('No grocery items found in this menu. Try generating a new menu with recipes.');
        }
      } else {
        setError('No menus found. Generate a menu first!');
      }
    }
    
  } catch (err) {
    console.error('Shopping list fetch error:', err);
    
    if (err.response?.status === 404) {
      setError('No grocery lists found. Generate a menu first!');
    } else if (err.response?.status === 401) {
      navigate('/login');
    } else if (err.response?.status === 422) {
      setError('The menu format is not compatible with grocery lists. Try a different menu.');
    } else {
      setError(`Failed to load grocery list: ${err.message || 'Unknown error'}`);
    }
  } finally {
    setLoading(false);
  }
};
  
  // Menu selection handler
  const handleMenuSelect = async (menuId) => {
    try {
      setLoading(true);
      const groceryListResponse = await apiService.getGroceryListByMenuId(menuId);
      
      setGroceryList(groceryListResponse.groceryList);
      setSelectedMenuId(menuId);
    } catch (err) {
      console.error('Error selecting menu:', err);
      setError('Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  };

  // Cache management functions
  const getCachedShoppingList = (menuId) => {
    try {
      const cacheString = localStorage.getItem(AI_SHOPPING_CACHE_KEY);
      if (!cacheString) return null;
      
      const cacheData = JSON.parse(cacheString);
      
      // Check if we have cached data for this menu
      if (!cacheData[menuId]) return null;
      
      const menuCache = cacheData[menuId];
      
      // Check if cache has expired
      const now = Date.now();
      if (now - menuCache.timestamp > CACHE_EXPIRY_MS) {
        console.log("Shopping list cache expired for menu", menuId);
        // Remove expired cache
        delete cacheData[menuId];
        localStorage.setItem(AI_SHOPPING_CACHE_KEY, JSON.stringify(cacheData));
        return null;
      }
      
      console.log("Found valid cached shopping list for menu", menuId);
      return menuCache.data;
    } catch (error) {
      console.error("Error reading cache:", error);
      return null;
    }
  };
  
  const setCachedShoppingList = (menuId, data) => {
    try {
      // Get existing cache
      const cacheString = localStorage.getItem(AI_SHOPPING_CACHE_KEY);
      const cacheData = cacheString ? JSON.parse(cacheString) : {};
      
      // Update cache with new data and timestamp
      cacheData[menuId] = {
        data,
        timestamp: Date.now(),
        preferences: aiPreferences || null
      };
      
      // Save updated cache
      localStorage.setItem(AI_SHOPPING_CACHE_KEY, JSON.stringify(cacheData));
      console.log("Cached shopping list for menu", menuId);
    } catch (error) {
      console.error("Error writing cache:", error);
    }
  };
  
  // Status polling mechanism for AI shopping list
  const [statusPollingInterval, setStatusPollingInterval] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 60; // Maximum number of status checks (5 minutes at 5-second intervals)
  const POLL_INTERVAL = 5000; // Poll every 5 seconds

  // Function to check the status of an AI shopping list
  const checkAiShoppingListStatus = async (menuId) => {
    if (!menuId || pollCount >= MAX_POLLS) {
      // Stop polling if we've reached the maximum number of polls
      if (pollCount >= MAX_POLLS) {
        console.log(`Maximum polls (${MAX_POLLS}) reached, stopping status checks`);
        setSnackbarMessage("AI processing is taking longer than expected. Stopping status checks.");
        setSnackbarOpen(true);
      }
      clearStatusPolling();
      return;
    }

    try {
      console.log(`Polling AI shopping list status (attempt ${pollCount + 1}/${MAX_POLLS})`);
      const statusResponse = await apiService.getAiShoppingListStatus(menuId, aiPreferences);
      console.log("Status response:", statusResponse);

      // Update poll count
      setPollCount(prevCount => prevCount + 1);

      // Check if processing is complete
      if (statusResponse.status === "completed") {
        console.log("AI shopping list processing completed!");

        // Stop the polling
        clearStatusPolling();

        // Format and normalize all items to ensure quantities are shown
        if (statusResponse.groceryList && Array.isArray(statusResponse.groceryList)) {
          statusResponse.groceryList.forEach(category => {
            if (category.items && Array.isArray(category.items)) {
              category.items = category.items.map(item => {
                // If item is just a string, convert to object with name
                if (typeof item === "string") {
                  return {
                    name: item,
                    quantity: "1",
                    unit: "",
                    display_name: `${item}: 1`
                  };
                }
                // If item is object but missing quantity/unit, add them
                else if (typeof item === "object") {
                  // Ensure name exists
                  const name = item.name || "Unknown item";
                  // Ensure quantity exists
                  const quantity = item.quantity || "1";
                  // Ensure unit exists
                  const unit = item.unit || "";
                  // Create or update display_name
                  const display_name = `${name}: ${quantity} ${unit}`.trim();

                  return {
                    ...item,
                    name,
                    quantity,
                    unit,
                    display_name
                  };
                }
                return item;
              });
            }
          });
        }

        // Update state with the completed data
        setAiShoppingData(statusResponse);
        setAiShoppingLoading(false);

        // Show notification only on first couple of polls to prevent looping
        if (pollCount <= 2) {
          setSnackbarMessage("AI shopping list ready!");
          setSnackbarOpen(true);
        }

        // Cache the results
        setCachedShoppingList(menuId, statusResponse);
      }
      // Handle "error" status
      else if (statusResponse.status === "error") {
        console.log("AI shopping list processing error:", statusResponse.message);

        // Stop the polling
        clearStatusPolling();

        // Show error message
        setSnackbarMessage(`AI processing error: ${statusResponse.message || "Unknown error"}`);
        setSnackbarOpen(true);

        // Still update the data with what we got (might contain fallback data)
        setAiShoppingData(statusResponse);
        setAiShoppingLoading(false);
      }
      // Handle "not found" status (processing hasn't started or cache expired)
      else if (statusResponse.status === "not_found" || statusResponse.status === "expired") {
        console.warn("AI processing status not found or expired");

        // Stop polling as there's nothing to poll for
        clearStatusPolling();

        // Notify user
        setSnackbarMessage("AI processing not found. Please try again.");
        setSnackbarOpen(true);
        setAiShoppingLoading(false);
      }
      // For "processing" status, we continue polling until completion or max attempts
    } catch (err) {
      console.error("Error checking AI shopping list status:", err);

      // Don't stop polling on error, just log it and continue
      // This makes the polling more resilient to temporary network issues
    }
  };

  // Helper to clear the polling interval
  const clearStatusPolling = () => {
    if (statusPollingInterval) {
      console.log("Clearing status polling interval");
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
      setPollCount(0);
    }
  };

  // Function to start polling for status updates
  const startStatusPolling = (menuId) => {
    // Clear any existing polling first
    clearStatusPolling();

    // Reset poll count
    setPollCount(0);

    // Start a new polling interval
    console.log(`Starting status polling for menu ${menuId}`);
    const intervalId = setInterval(() => checkAiShoppingListStatus(menuId), POLL_INTERVAL);
    setStatusPollingInterval(intervalId);

    // Do an immediate check
    checkAiShoppingListStatus(menuId);
  };

  // Clean up interval on component unmount
  useEffect(() => {
    return () => clearStatusPolling();
  }, []);

  // Function to load AI shopping list with caching
  const loadAiShoppingList = async (menuId, forceRefresh = false) => {
    if (!menuId) return null;

    setAiShoppingLoading(true);

    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = getCachedShoppingList(menuId);
        if (cachedData) {
          console.log("Using cached AI shopping list");
          setAiShoppingData(cachedData);
          setUsingAiList(true);
          setAiShoppingLoading(false);

          // Show snackbar to indicate cached data is being used
          setSnackbarMessage("Using cached shopping list");
          setSnackbarOpen(true);

          return cachedData;
        }
      }

      // No cache or refresh requested, make API call
      console.log(`Requesting AI shopping list for menu ${menuId}`);
      const aiResponse = await apiService.generateAiShoppingList(menuId, aiPreferences);
      console.log("AI shopping list response:", aiResponse);

      // Validate response has required data
      if (!aiResponse) {
        throw new Error("Empty response from AI shopping list service");
      }

      // Check for explicit error message
      if (aiResponse.error) {
        console.warn("API returned error:", aiResponse.error);
        setSnackbarMessage(`Error: ${aiResponse.error}. Using standard list.`);
        setSnackbarOpen(true);

        // If there's no grocery list data, don't switch to AI view
        if (!aiResponse.groceryList ||
            (Array.isArray(aiResponse.groceryList) && aiResponse.groceryList.length === 0)) {
          setUsingAiList(false);
          setAiShoppingLoading(false);
          return null;
        }
      }

      // Even with errors, if we have some data, display it
      setAiShoppingData(aiResponse);
      setUsingAiList(true);

      // If we have partial data with missing fields, add default values
      if (!aiResponse.recommendations || !Array.isArray(aiResponse.recommendations)) {
        console.log("Adding default recommendations");
        aiResponse.recommendations = ["Shop by category to save time in the store"];
      }

      if (!aiResponse.nutritionTips || !Array.isArray(aiResponse.nutritionTips)) {
        console.log("Adding default nutrition tips");
        aiResponse.nutritionTips = ["Focus on whole foods for better nutrition"];
      }

      if (!aiResponse.healthySwaps || !Array.isArray(aiResponse.healthySwaps)) {
        console.log("Adding default healthy swaps list");
        aiResponse.healthySwaps = [];
      }

      // Check if the response indicates processing is still happening
      if (aiResponse.status === "processing") {
        console.log("AI shopping list is being processed, starting status polling");

        // Start polling for status updates
        startStatusPolling(menuId);
      } else {
        // If not processing, we're done
        setAiShoppingLoading(false);

        // Cache the successful response if it's completed
        if (aiResponse.status === "completed" && aiResponse.groceryList) {
          setCachedShoppingList(menuId, aiResponse);
        }
      }

      return aiResponse;
    } catch (err) {
      console.error("Error generating AI shopping list:", err);
      setSnackbarMessage("Error generating AI shopping list. Using standard list instead.");
      setSnackbarOpen(true);
      setUsingAiList(false);
      setAiShoppingLoading(false);
      return null;
    }
  };

  // Handler for AI prompt dialog
  const handleAiPromptResponse = async (useAi) => {
    setShowAiShoppingPrompt(false);
    
    if (useAi) {
      // User chose AI shopping list - use the new loadAiShoppingList function
      await loadAiShoppingList(selectedMenuId);
    } else {
      // User chose standard shopping list
      setUsingAiList(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchShoppingListData();
    
    // Check if we have a cached AI shopping list for this menu
    if (selectedMenuId) {
      const cachedData = getCachedShoppingList(selectedMenuId);
      
      if (cachedData) {
        // Use cached data
        console.log("Using cached shopping list data on initial load");
        setAiShoppingData(cachedData);
        setUsingAiList(true);
        setActiveTab(1); // Switch to AI tab if we have cached data
        
        // Show a toast notification that we're using cached data
        setSnackbarMessage("Using cached AI shopping list");
        setSnackbarOpen(true);
      } else if (!showAiShoppingPrompt && !aiShoppingData) {
        // No cache, show AI prompt
        setShowAiShoppingPrompt(true);
      }
    }
  }, [user, selectedMenuId]);

const categorizeItems = (mealPlanData) => {
  let ingredientsList = [];
  console.log("Categorizing items from data:", mealPlanData);

  // Handle case where we get a groceryList array directly
  if (mealPlanData && mealPlanData.groceryList && Array.isArray(mealPlanData.groceryList)) {
    console.log("Using groceryList property directly:", mealPlanData.groceryList);
    return { "All Items": mealPlanData.groceryList };
  }

  // First, determine the structure of the input data
  if (Array.isArray(mealPlanData)) {
    // If it's already a direct list of ingredients
    console.log("Data is an array, using directly");
    ingredientsList = mealPlanData;
  } else if (mealPlanData && (mealPlanData.meal_plan || mealPlanData.meal_plan_json)) {
    // If it's a structured meal plan object
    console.log("Found meal_plan or meal_plan_json property, processing structured data");
    
    let mealPlan;
    try {
      // Try meal_plan first, then meal_plan_json
      if (mealPlanData.meal_plan) {
        mealPlan = typeof mealPlanData.meal_plan === 'string' 
          ? JSON.parse(mealPlanData.meal_plan) 
          : mealPlanData.meal_plan;
      } else if (mealPlanData.meal_plan_json) {
        mealPlan = typeof mealPlanData.meal_plan_json === 'string' 
          ? JSON.parse(mealPlanData.meal_plan_json) 
          : mealPlanData.meal_plan_json;
      }
      console.log("Parsed meal plan data:", mealPlan);
    } catch (e) {
      console.error("Error parsing meal plan:", e);
      mealPlan = { days: [] };
    }

    // Extract ingredients from days, meals, and snacks
    if (mealPlan && mealPlan.days && Array.isArray(mealPlan.days)) {
      console.log(`Processing ${mealPlan.days.length} days of meals`);
      
      mealPlan.days.forEach(day => {
        // Process meals
        if (day.meals && Array.isArray(day.meals)) {
          day.meals.forEach(meal => {
            if (meal.ingredients && Array.isArray(meal.ingredients)) {
              console.log(`Found ${meal.ingredients.length} ingredients in meal: ${meal.title || 'Unnamed'}`);
              
              const processedIngredients = meal.ingredients.map(ing => {
                if (typeof ing === 'string') return ing.trim();
                return `${ing.quantity || ''} ${ing.name || ''}`.trim();
              }).filter(ing => ing.length > 0);
              
              ingredientsList.push(...processedIngredients);
            }
          });
        }

        // Process snacks
        if (day.snacks && Array.isArray(day.snacks)) {
          day.snacks.forEach(snack => {
            // Handle both snack formats (object with ingredients or simple object)
            if (snack.ingredients && Array.isArray(snack.ingredients)) {
              console.log(`Found ${snack.ingredients.length} ingredients in snack: ${snack.title || 'Unnamed'}`);
              
              const processedIngredients = snack.ingredients.map(ing => {
                if (typeof ing === 'string') return ing.trim();
                return `${ing.quantity || ''} ${ing.name || ''}`.trim();
              }).filter(ing => ing.length > 0);
              
              ingredientsList.push(...processedIngredients);
            } else if (snack.title && snack.quantity) {
              // This is for snacks in the format { title, quantity, ... } without ingredients array
              console.log(`Found simple snack: ${snack.title}`);
              const snackItem = `${snack.quantity || ''} ${snack.title || ''}`.trim();
              if (snackItem.length > 0) {
                ingredientsList.push(snackItem);
              }
            }
          });
        }
      });
    }
  }
  
  // If ingredientsList is still empty but we have a groceryList somewhere in the data
  if (ingredientsList.length === 0 && typeof mealPlanData === 'object') {
    // Try to find a groceryList in a nested property
    const findGroceryList = (obj, depth = 0) => {
      if (depth > 3) return null; // Limit depth to avoid infinite recursion
      
      if (obj && obj.groceryList && Array.isArray(obj.groceryList)) {
        return obj.groceryList;
      }
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const result = findGroceryList(obj[key], depth + 1);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    const foundList = findGroceryList(mealPlanData);
    if (foundList) {
      console.log("Found groceryList in nested property:", foundList);
      ingredientsList = foundList;
    }
  }
  
  console.log(`Final ingredients list has ${ingredientsList.length} items`);
  if (ingredientsList.length === 0) {
    // Return a default empty category to prevent errors
    return { "No Items Found": [] };
  }

  // Categorization logic
  const categorizedItems = {};
  const ingredientTotals = {};

  // Helper function to parse quantity
  const parseQuantity = (quantityStr) => {
    if (!quantityStr) return 1;
    
    const parts = quantityStr.split(/\s+/);
    let total = 0;

    parts.forEach(part => {
      if (part.includes('/')) {
        const [num, denom] = part.split('/');
        total += parseFloat(num) / parseFloat(denom);
      } else {
        const num = parseFloat(part);
        if (!isNaN(num)) {
          total += num;
        }
      }
    });

    return total || 1;
  };

  // Helper function to combine multiple quantities
  const combineQuantities = (quantityStr) => {
    const parts = quantityStr.split(/\s+/);
    let totalQuantity = 0;
    let lastUnit = '';

    for (let i = 0; i < parts.length; i++) {
      const num = parseFloat(parts[i]);
      if (!isNaN(num)) {
        const nextPart = parts[i + 1];
        const unitConversions = {
          'tablespoon': 1/16,
          'tbsp': 1/16,
          'teaspoon': 1/48,
          'tsp': 1/48
        };

        if (nextPart && unitConversions[nextPart.toLowerCase()]) {
          totalQuantity += num * unitConversions[nextPart.toLowerCase()];
          lastUnit = 'cup';
          i++;
        } else {
          totalQuantity += num;
          lastUnit = '';
        }
      }
    }

    return { quantity: totalQuantity, unit: lastUnit };
  };

  // Helper function to guess the most appropriate unit
  const guessAppropriateUnit = (itemName, currentUnit) => {
    const unitMappings = {
      'quinoa': 'cup',
      'rice vinegar': 'tbsp',
      'tortilla': 'piece',
      'black bean': 'cup',
      'edamame': 'cup',
      'almond': 'tbsp',
      'basil': 'cup',
      'berrie': 'cup',
      'chickpea': 'can',
      'olive': 'cup',
      'hummu': 'cup',
      'seed': 'tbsp',
      'avocado': 'piece',
      'jalapeno': 'piece',
      'tomato': 'piece',
      'cucumber': 'piece',
      'bell pepper': 'piece',
      'onion': 'piece',
      'garlic': 'clove',
      'egg': 'piece',
      'cheese': 'cup'
    };

    // If current unit is already valid, keep it
    const STANDARD_UNITS = {
      volume: ['cup', 'tbsp', 'tsp', 'ml', 'l'],
      weight: ['oz', 'lb', 'g', 'kg'],
      count: ['slice', 'piece', 'can', 'scoop', 'clove', 'egg'],
      special: ['leaves', 'kernel', 'seed']
    };

    if (STANDARD_UNITS.volume.includes(currentUnit) ||
        STANDARD_UNITS.weight.includes(currentUnit) ||
        STANDARD_UNITS.count.includes(currentUnit) ||
        STANDARD_UNITS.special.includes(currentUnit)) {
      return currentUnit;
    }

    // Find the most appropriate unit based on the ingredient name
    for (const [ingredient, unit] of Object.entries(unitMappings)) {
      if (itemName.toLowerCase().includes(ingredient)) {
        return unit;
      }
    }

    // Default to no unit if no other unit is found
    return '';
  };

  // Process and combine ingredients
  ingredientsList.forEach(item => {
    let fullItemName = item.trim().toLowerCase();

    // First, try to combine complex quantities
    const combinedQuantity = combineQuantities(fullItemName);
    let quantity = combinedQuantity.quantity;
    let unit = combinedQuantity.unit;

    // Extract quantity and unit if not already parsed
    const quantityRegex = /^((?:\d+\s*)*(?:\d*\/?\d+)?)\s*(cup|tbsp|tsp|oz|lb|can|slice|clove|piece|scoop)s?\s*(.*)/i;
    const match = fullItemName.match(quantityRegex);

    if (match) {
      quantity = parseQuantity(match[1]);
      unit = match[2] || '';
      fullItemName = match[3].trim();
    }

    // Skip if item is now empty
    if (!fullItemName) return;

    // Guess appropriate unit if needed
    unit = guessAppropriateUnit(fullItemName, unit);

    // Normalize item name (remove plurals)
    const normalizedItemName = fullItemName.replace(/s$/, '');

    // Combine total quantity for similar items
    if (!ingredientTotals[normalizedItemName]) {
      ingredientTotals[normalizedItemName] = { 
        quantity: quantity, 
        unit: unit 
      };
    } else {
      ingredientTotals[normalizedItemName].quantity += quantity;
    }
  });

  // Categorize normalized items
  Object.entries(ingredientTotals).forEach(([itemName, details]) => {
    const category = Object.keys(CATEGORY_MAPPING).find(cat => 
      CATEGORY_MAPPING[cat].some(keyword => 
        itemName.toLowerCase().includes(keyword.toLowerCase())
      )
    ) || 'Other';
    
    if (!categorizedItems[category]) {
      categorizedItems[category] = [];
    }
    
    // Improved formatting logic
    const formattedItem = details.quantity > 1 
      ? `${details.quantity} ${details.unit ? details.unit + 's' : ''} ${itemName}`.trim()
      : details.unit 
        ? `${details.unit} ${itemName}`.trim()
        : `${details.quantity} ${itemName}`.trim();

    categorizedItems[category].push(formattedItem);
  });
  
  return categorizedItems;
};
  
  // State for Kroger store selector
  const [showKrogerStoreSelector, setShowKrogerStoreSelector] = useState(false);
  const [pendingAllItems, setPendingAllItems] = useState(false);
  
  // Store search handler
  const handleStoreSearchAll = async () => {
    try {
      if (selectedStore === 'mixed') {
        return;
      }
      
      // For Kroger, check if we have a configured store first
      if (selectedStore === 'kroger') {
        const isConfigured = localStorage.getItem('kroger_store_configured') === 'true';
        const locationId = localStorage.getItem('kroger_store_location_id');
        
        if (!isConfigured || !locationId) {
          console.log("Kroger store not configured, showing selector for all items");
          setPendingAllItems(true);
          setShowKrogerStoreSelector(true);
          return;
        }
      }

      // Add all items to internal cart
      await apiService.addToInternalCart({
        items: groceryList.map(item => ({
          name: typeof item === 'string' ? item : item.name,
          quantity: 1,
          store_preference: selectedStore
        })),
        store: selectedStore
      });

      setSnackbarMessage(`Items added to ${selectedStore} cart`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(`Error processing ${selectedStore} items:`, err);
      
      // Check if this is a Kroger setup error
      if (err.response?.data?.needs_setup && selectedStore === 'kroger') {
        console.log("Kroger needs setup, showing store selector");
        setPendingAllItems(true);
        setShowKrogerStoreSelector(true);
        return;
      }
      
      setError(`Failed to process items in ${selectedStore}`);
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarOpen(true);
    }
  };
  
  // Handle Kroger store selection
  const handleKrogerStoreSelect = async (locationId) => {
    try {
      console.log(`Selected Kroger store location: ${locationId}`);
      
      const result = await apiService.updateKrogerLocation(locationId);
      
      if (result.success) {
        // Store was successfully set
        console.log("Kroger store location set successfully");
        localStorage.setItem('kroger_store_configured', 'true');
        
        // Close the dialog
        setShowKrogerStoreSelector(false);
        
        // If we had pending items to add to cart, do it now
        if (pendingAllItems) {
          try {
            await apiService.addToInternalCart({
              items: groceryList.map(item => ({
                name: typeof item === 'string' ? item : item.name,
                quantity: 1,
                store_preference: 'kroger'
              })),
              store: 'kroger'
            });
            
            setSnackbarMessage(`Items added to Kroger cart`);
            setSnackbarOpen(true);
          } catch (cartErr) {
            console.error("Error adding items to Kroger cart:", cartErr);
            setSnackbarMessage(`Error adding items to Kroger cart: ${cartErr.message}`);
            setSnackbarOpen(true);
          }
          
          setPendingAllItems(false);
        }
      } else {
        setError(result.message || "Failed to set store location");
        setSnackbarMessage(`Error: ${result.message}`);
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error("Error setting store location:", err);
      setError(err.message || "An error occurred setting the store location");
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarOpen(true);
    }
  };

  // Add to cart handler for single store
  const handleAddToCart = async (item, store) => {
    try {
      await apiService.addToInternalCart({
        items: [{
          name: item,
          quantity: 1,
          store_preference: store
        }],
        store
      });

      setSnackbarMessage(`Added ${item} to ${store} cart`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(`Error adding ${item} to ${store} cart:`, err);
      let errorMessage = `Failed to add ${item} to ${store} cart`;
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
    }
  };

  // Add to cart handler for mixed stores
  const handleAddToMixedCart = async (item, selectedStore) => {
    if (selectedStore === 'mixed') {
      return;
    }
    await handleAddToCart(item, selectedStore);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Shopping List
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {menuHistory.length > 0 && (
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>Select Menu</InputLabel>
            <Select
              value={selectedMenuId || ''}
              label="Select Menu"
              onChange={(e) => handleMenuSelect(e.target.value)}
              disabled={loading}
            >
              {menuHistory.map((menuItem) => (
                <MenuItem 
                  key={menuItem.menu_id} 
                  value={menuItem.menu_id}
                >
                  {menuItem.nickname || `Menu from ${new Date(menuItem.created_at).toLocaleDateString()}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl sx={{ flex: 1 }}>
          <InputLabel>Store Search Mode</InputLabel>
          <Select
            value={selectedStore}
            label="Store Search Mode"
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <MenuItem value="walmart">Walmart</MenuItem>
            <MenuItem value="kroger">Kroger</MenuItem>
            <MenuItem value="mixed">Mixed Stores</MenuItem>
          </Select>
        </FormControl>

        {selectedStore !== 'mixed' && groceryList.length > 0 && (
          <Button 
            variant="contained" 
            onClick={handleStoreSearchAll}
            disabled={loading}
          >
            Add All to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
          </Button>
        )}
      </Box>

      {/* Shopping List Display with Tabs */}
      {groceryList && groceryList.length > 0 ? (
        <Box sx={{ width: '100%' }}>
          {/* Only show tab interface if we have AI data */}
          {aiShoppingData ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Tabs 
                  value={activeTab} 
                  onChange={(e, newValue) => setActiveTab(newValue)}
                  aria-label="shopping list tabs"
                >
                  <Tab 
                    icon={<BasketIcon />} 
                    label="Standard" 
                    id="tab-0" 
                    aria-controls="tabpanel-0" 
                  />
                  <Tab 
                    icon={<AiIcon />} 
                    label="AI Enhanced" 
                    id="tab-1" 
                    aria-controls="tabpanel-1" 
                  />
                </Tabs>
                
                {/* Refresh button to regenerate AI shopping list */}
                <Button 
                  variant="outlined" 
                  color="primary" 
                  disabled={aiShoppingLoading}
                  startIcon={aiShoppingLoading ? <CircularProgress size={20} /> : <AiIcon />}
                  onClick={() => loadAiShoppingList(selectedMenuId, true)} // Force refresh
                >
                  Regenerate AI List
                </Button>
              </Box>
              
              {/* Standard List Tab Panel */}
              <div
                role="tabpanel"
                hidden={activeTab !== 0}
                id="tabpanel-0"
                aria-labelledby="tab-0"
              >
                {activeTab === 0 && (
                  <ShoppingList 
                    categories={formatCategoriesForDisplay(groceryList)} 
                    selectedStore={selectedStore} 
                    onAddToCart={handleAddToCart} 
                    onAddToMixedCart={handleAddToMixedCart} 
                  />
                )}
              </div>
              
              {/* AI Enhanced List Tab Panel */}
              <div
                role="tabpanel"
                hidden={activeTab !== 1}
                id="tabpanel-1"
                aria-labelledby="tab-1"
              >
                {activeTab === 1 && aiShoppingData && (
                  <Box>
                    {/* Display cache info if applicable */}
                    {aiShoppingData.cached && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Using cached shopping list from {new Date(aiShoppingData.cache_time).toLocaleString()}. 
                        <Button 
                          size="small" 
                          sx={{ ml: 2 }}
                          onClick={() => loadAiShoppingList(selectedMenuId, true)}
                        >
                          Refresh
                        </Button>
                      </Alert>
                    )}
                    
                    {/* AI Tips and Recommendations */}
                    {aiShoppingData.nutritionTips && Array.isArray(aiShoppingData.nutritionTips) && aiShoppingData.nutritionTips.length > 0 && (
                      <Card sx={{ mb: 3 }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <TipsIcon sx={{ mr: 1 }} color="primary" />
                            <Typography variant="h6">Nutrition Tips</Typography>
                          </Box>
                          <List dense>
                            {aiShoppingData.nutritionTips.map((tip, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><TipsIcon color="primary" /></ListItemIcon>
                                <ListItemText primary={tip} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    )}
                    
                    {aiShoppingData.recommendations && Array.isArray(aiShoppingData.recommendations) && aiShoppingData.recommendations.length > 0 && (
                      <Card sx={{ mb: 3 }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <OfferIcon sx={{ mr: 1 }} color="primary" />
                            <Typography variant="h6">Shopping Recommendations</Typography>
                          </Box>
                          <List dense>
                            {aiShoppingData.recommendations.map((rec, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><OfferIcon color="primary" /></ListItemIcon>
                                <ListItemText primary={rec} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Pantry Items Section */}
                    {aiShoppingData.pantryStaples && Array.isArray(aiShoppingData.pantryStaples) && aiShoppingData.pantryStaples.length > 0 && (
                      <Card sx={{ mb: 3 }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <KitchenIcon sx={{ mr: 1 }} color="primary" />
                            <Typography variant="h6">Common Pantry Items</Typography>
                          </Box>
                          <List dense>
                            {aiShoppingData.pantryStaples.map((item, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><KitchenIcon color="primary" /></ListItemIcon>
                                <ListItemText primary={item} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Healthy Swaps Section */}
                    {aiShoppingData.healthySwaps && Array.isArray(aiShoppingData.healthySwaps) && aiShoppingData.healthySwaps.length > 0 && (
                      <Card sx={{ mb: 3 }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <TipsIcon sx={{ mr: 1 }} color="success" />
                            <Typography variant="h6">Healthy Alternatives</Typography>
                          </Box>
                          <List dense>
                            {aiShoppingData.healthySwaps.map((item, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><TipsIcon color="success" /></ListItemIcon>
                                <ListItemText primary={item} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* AI Categorized Shopping List */}
                    {aiShoppingData.groceryList && Array.isArray(aiShoppingData.groceryList) && aiShoppingData.groceryList.length > 0 ? (
                      // Case: AI returned properly categorized groceries
                      aiShoppingData.groceryList.map((category, index) => (
                        <Accordion key={index} defaultExpanded={true} sx={{ mb: 1 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box display="flex" alignItems="center">
                              <CategoryIcon sx={{ mr: 1 }} />
                              <Typography variant="h6">{category.category || "Category " + (index + 1)}</Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={2}>
                              {category.items && Array.isArray(category.items) ? (
                                category.items.map((item, itemIndex) => (
                                  <Grid item xs={12} sm={6} key={itemIndex}>
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body1" fontWeight="medium">
                                        {typeof item === 'string' ? item : (item.name || 'Unknown item')}
                                      </Typography>
                                      {item.notes && (
                                        <Typography variant="body2" color="text.secondary">
                                          {item.notes}
                                        </Typography>
                                      )}
                                      {item.alternatives && (
                                        <Typography variant="body2" color="primary">
                                          Alt: {item.alternatives}
                                        </Typography>
                                      )}
                                      {item.healthyAlternatives && (
                                        <Typography variant="body2" color="success.main">
                                          Healthy Option: {item.healthyAlternatives}
                                        </Typography>
                                      )}
                                      <Box sx={{ mt: 1 }}>
                                        {selectedStore === 'mixed' ? (
                                          <>
                                            <Button 
                                              variant="outlined" 
                                              size="small" 
                                              sx={{ mr: 1 }}
                                              onClick={() => handleAddToMixedCart(typeof item === 'string' ? item : item.name, 'walmart')}
                                            >
                                              Add to Walmart
                                            </Button>
                                            <Button 
                                              variant="outlined" 
                                              size="small" 
                                              onClick={() => handleAddToMixedCart(typeof item === 'string' ? item : item.name, 'kroger')}
                                            >
                                              Add to Kroger
                                            </Button>
                                          </>
                                        ) : (
                                          <Button 
                                            variant="outlined" 
                                            size="small" 
                                            onClick={() => handleAddToCart(typeof item === 'string' ? item : item.name, selectedStore)}
                                          >
                                            Add to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
                                          </Button>
                                        )}
                                      </Box>
                                    </Box>
                                  </Grid>
                                ))
                              ) : (
                                <Grid item xs={12}>
                                  <Typography>No items in this category</Typography>
                                </Grid>
                              )}
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      ))
                    ) : (
                      // Fallback: If AI response doesn't have the expected structure,
                      // show original list in a single category
                      <Accordion defaultExpanded={true} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box display="flex" alignItems="center">
                            <CategoryIcon sx={{ mr: 1 }} />
                            <Typography variant="h6">All Items</Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            {groceryList && groceryList.length > 0 ? (
                              groceryList.map((item, index) => (
                                <Grid item xs={12} sm={6} key={index}>
                                  <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" fontWeight="medium">
                                      {typeof item === 'string' ? item : (item.name || 'Unknown item')}
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                      {selectedStore === 'mixed' ? (
                                        <>
                                          <Button 
                                            variant="outlined" 
                                            size="small" 
                                            sx={{ mr: 1 }}
                                            onClick={() => handleAddToMixedCart(typeof item === 'string' ? item : item.name, 'walmart')}
                                          >
                                            Add to Walmart
                                          </Button>
                                          <Button 
                                            variant="outlined" 
                                            size="small" 
                                            onClick={() => handleAddToMixedCart(typeof item === 'string' ? item : item.name, 'kroger')}
                                          >
                                            Add to Kroger
                                          </Button>
                                        </>
                                      ) : (
                                        <Button 
                                          variant="outlined" 
                                          size="small" 
                                          onClick={() => handleAddToCart(typeof item === 'string' ? item : item.name, selectedStore)}
                                        >
                                          Add to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
                                        </Button>
                                      )}
                                    </Box>
                                  </Box>
                                </Grid>
                              ))
                            ) : (
                              <Grid item xs={12}>
                                <Typography>No items available</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Box>
                )}
              </div>
            </>
          ) : (
            // No AI data, just show regular shopping list
            <ShoppingList 
              categories={formatCategoriesForDisplay(groceryList)} 
              selectedStore={selectedStore} 
              onAddToCart={handleAddToCart} 
              onAddToMixedCart={handleAddToMixedCart} 
            />
          )}
        </Box>
      ) : (
        !loading && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No grocery items found for this menu. The menu might not have any ingredients listed, or there might be an issue with the menu data.
          </Alert>
        )
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
      
      {/* AI Shopping List Prompt Dialog */}
      <Dialog
        open={showAiShoppingPrompt}
        onClose={() => handleAiPromptResponse(false)}
        aria-labelledby="ai-shopping-dialog-title"
      >
        <DialogTitle id="ai-shopping-dialog-title">
          <Box display="flex" alignItems="center">
            <AiIcon sx={{ mr: 1 }} color="primary" />
            Use AI-Enhanced Shopping List?
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to generate an AI-enhanced shopping list with:
          </DialogContentText>
          <List>
            <ListItem>
              <ListItemIcon><CategoryIcon /></ListItemIcon>
              <ListItemText primary="Smart categorization by store section" />
            </ListItem>
            <ListItem>
              <ListItemIcon><OfferIcon /></ListItemIcon>
              <ListItemText primary="Alternative brand suggestions" />
            </ListItem>
            <ListItem>
              <ListItemIcon><TipsIcon /></ListItemIcon>
              <ListItemText primary="Nutritional tips and information" />
            </ListItem>
            <ListItem>
              <ListItemIcon><KitchenIcon /></ListItemIcon>
              <ListItemText primary="Common pantry staples identification" />
            </ListItem>
            <ListItem>
              <ListItemIcon><TipsIcon color="success" /></ListItemIcon>
              <ListItemText primary="Healthy alternatives to ingredients" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleAiPromptResponse(false)}>No, Just Regular List</Button>
          <Button 
            onClick={() => handleAiPromptResponse(true)} 
            variant="contained" 
            startIcon={<AiIcon />}
            color="primary"
          >
            Yes, Use AI
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Kroger Store Selection Dialog */}
      <StoreSelector 
        open={showKrogerStoreSelector}
        onClose={() => setShowKrogerStoreSelector(false)}
        onStoreSelect={handleKrogerStoreSelect}
        storeType="kroger"
      />
    </Container>
  );
}

export default ShoppingListPage;