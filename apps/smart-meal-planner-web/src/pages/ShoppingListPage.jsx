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
import SmartShoppingList from '../components/SmartShoppingList';
import { adaptShoppingListResponse } from '../utils/aiShoppingListAdapter';
import { 
  AutoAwesome as AiIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingBasket as BasketIcon,
  TipsAndUpdates as TipsIcon,
  LocalOffer as OfferIcon,
  Kitchen as KitchenIcon,
  Category as CategoryIcon,
  AutoAwesome,
  ExpandMore
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
  const [lastSnackbarTime, setLastSnackbarTime] = useState(0);
  const [viewMode, setViewMode] = useState('regular'); // 'regular' or 'smart'

  // Helper function to show snackbar with debouncing to prevent duplicates
  const showSnackbar = (message) => {
    const now = Date.now();
    // Only show a new snackbar if it's been at least 2 seconds since the last one
    // or if the message is different
    if (now - lastSnackbarTime > 2000 || message !== snackbarMessage) {
      setSnackbarMessage(message);
      setSnackbarOpen(true);
      setLastSnackbarTime(now);
    } else {
      console.log(`Suppressing duplicate snackbar: ${message}`);
    }
  };
  
  // AI shopping list state
  const [showAiShoppingPrompt, setShowAiShoppingPrompt] = useState(false);
  const [aiShoppingLoading, setAiShoppingLoading] = useState(false);
  const [aiShoppingData, setAiShoppingData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [aiPreferences, setAiPreferences] = useState('');
  const [usingAiList, setUsingAiList] = useState(false);

  // For New AI List button
  const [generationStats, setGenerationStats] = useState(null);
  const [generationLogs, setGenerationLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true); // Show logs by default

  // For entertaining messages while loading
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadingMessages = [
    "AI chef is chopping ingredients into categories...",
    "Sorting your tomatoes from your potatoes...",
    "Figuring out what aisle the quinoa is in...",
    "Counting how many eggs you'll need...",
    "Calculating the perfect amount of garlic (always more)...",
    "Organizing your shopping route for maximum efficiency...",
    "Deciding whether avocados should be in produce or 'temperamental fruits'...",
    "Making sure you don't forget the salt this time...",
    "Translating 'a pinch' into actual measurements...",
    "Checking if you really need more olive oil...",
    "Determining if ice cream counts as a dairy essential...",
    "Sorting ingredients by 'foods you'll actually use' vs 'aspirational purchases'..."
  ];
  
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
    // Safety check for null input
    if (!groceryItems) {
      console.warn('Null grocery items passed to formatCategoriesForDisplay');
      return {}; // Return empty object instead of crashing
    }

    // New check for menu JSON format - extract ingredients directly from menu data
    if (groceryItems.days && Array.isArray(groceryItems.days)) {
      console.log('Found menu JSON format - extracting ingredients directly');

      // Initialize categories
      const extractedCategories = {
        'Protein': [],
        'Produce': [],
        'Dairy': [],
        'Grains': [],
        'Pantry': [],
        'Other': []
      };

      try {
        // Process each day in the menu
        groceryItems.days.forEach(day => {
          // Process meals
          if (day.meals && Array.isArray(day.meals)) {
            day.meals.forEach(meal => {
              if (meal.ingredients && Array.isArray(meal.ingredients)) {
                meal.ingredients.forEach(ingredient => {
                  // Categorize the ingredient
                  let category = 'Other';
                  const nameStr = ingredient.name ? ingredient.name.toLowerCase() : '';

                  // Simple categorization
                  if (nameStr.includes('chicken') || nameStr.includes('beef') ||
                      nameStr.includes('meat') || nameStr.includes('turkey') ||
                      nameStr.includes('fish') || nameStr.includes('salmon') ||
                      nameStr.includes('protein')) {
                    category = 'Protein';
                  } else if (nameStr.includes('apple') || nameStr.includes('pepper') ||
                            nameStr.includes('broccoli') || nameStr.includes('carrot') ||
                            nameStr.includes('tomato') || nameStr.includes('lettuce') ||
                            nameStr.includes('veggie') || nameStr.includes('vegetable') ||
                            nameStr.includes('onion')) {
                    category = 'Produce';
                  } else if (nameStr.includes('milk') || nameStr.includes('cheese') ||
                            nameStr.includes('yogurt') || nameStr.includes('cream') ||
                            nameStr.includes('butter') || nameStr.includes('egg')) {
                    category = 'Dairy';
                  } else if (nameStr.includes('rice') || nameStr.includes('pasta') ||
                            nameStr.includes('bread') || nameStr.includes('flour') ||
                            nameStr.includes('oat') || nameStr.includes('quinoa') ||
                            nameStr.includes('tortilla')) {
                    category = 'Grains';
                  } else if (nameStr.includes('oil') || nameStr.includes('sauce') ||
                            nameStr.includes('vinegar') || nameStr.includes('spice') ||
                            nameStr.includes('honey') || nameStr.includes('salt') ||
                            nameStr.includes('pepper') || nameStr.includes('sugar')) {
                    category = 'Pantry';
                  }

                  // Add to the appropriate category
                  extractedCategories[category].push(ingredient);
                });
              }
            });
          }

          // Process snacks
          if (day.snacks && Array.isArray(day.snacks)) {
            day.snacks.forEach(snack => {
              if (snack.ingredients && Array.isArray(snack.ingredients)) {
                snack.ingredients.forEach(ingredient => {
                  // Categorize the ingredient
                  let category = 'Other';
                  const nameStr = ingredient.name ? ingredient.name.toLowerCase() : '';

                  // Simple categorization
                  if (nameStr.includes('chicken') || nameStr.includes('beef') ||
                      nameStr.includes('meat') || nameStr.includes('turkey') ||
                      nameStr.includes('fish') || nameStr.includes('salmon') ||
                      nameStr.includes('protein')) {
                    category = 'Protein';
                  } else if (nameStr.includes('apple') || nameStr.includes('pepper') ||
                            nameStr.includes('broccoli') || nameStr.includes('carrot') ||
                            nameStr.includes('tomato') || nameStr.includes('lettuce') ||
                            nameStr.includes('veggie') || nameStr.includes('vegetable') ||
                            nameStr.includes('onion')) {
                    category = 'Produce';
                  } else if (nameStr.includes('milk') || nameStr.includes('cheese') ||
                            nameStr.includes('yogurt') || nameStr.includes('cream') ||
                            nameStr.includes('butter') || nameStr.includes('egg')) {
                    category = 'Dairy';
                  } else if (nameStr.includes('rice') || nameStr.includes('pasta') ||
                            nameStr.includes('bread') || nameStr.includes('flour') ||
                            nameStr.includes('oat') || nameStr.includes('quinoa') ||
                            nameStr.includes('tortilla')) {
                    category = 'Grains';
                  } else if (nameStr.includes('oil') || nameStr.includes('sauce') ||
                            nameStr.includes('vinegar') || nameStr.includes('spice') ||
                            nameStr.includes('honey') || nameStr.includes('salt') ||
                            nameStr.includes('pepper') || nameStr.includes('sugar')) {
                    category = 'Pantry';
                  }

                  // Add to the appropriate category
                  extractedCategories[category].push(ingredient);
                });
              }
            });
          }
        });

        // Filter out empty categories and return
        const finalCategories = {};
        Object.entries(extractedCategories).forEach(([category, items]) => {
          if (items.length > 0) {
            finalCategories[category] = items;
          }
        });

        console.log('Extracted categories from menu data:', finalCategories);
        return finalCategories;
      } catch (error) {
        console.error('Error extracting categories from menu data:', error);
        // Fall back to empty categories
        return { 'Other': [] };
      }
    }

    // If already in expected format (object with category keys)
    if (!Array.isArray(groceryItems) && typeof groceryItems === 'object') {
      console.log('Grocery list already in category format:', groceryItems);

      // Verify the object actually has proper categories
      if (Object.keys(groceryItems).length === 0) {
        console.warn('Grocery list object has no categories');
        return { 'Other': [] };
      }

      // Do a quick scan for null/undefined items in each category
      const cleanedCategories = {};

      Object.entries(groceryItems).forEach(([category, items]) => {
        // Skip null categories or items
        if (!category || !items) return;

        // Create a valid category if needed
        cleanedCategories[category] = [];

        // If items is not an array, try to convert it
        if (!Array.isArray(items)) {
          if (typeof items === 'object') {
            console.log(`Category ${category} has non-array items, trying to extract values`);
            const extractedItems = Object.values(items).filter(item => item !== null && item !== undefined);
            cleanedCategories[category] = extractedItems;
          } else {
            console.log(`Category ${category} has invalid items type: ${typeof items}`);
            cleanedCategories[category] = [];
          }
        } else {
          // Normal case: items is an array, filter out null/undefined
          cleanedCategories[category] = items.filter(item => item !== null && item !== undefined);
        }
      });

      return cleanedCategories;
    }

    // If empty or invalid
    if (!groceryItems || !Array.isArray(groceryItems) || groceryItems.length === 0) {
      console.log('Empty or invalid grocery items:', groceryItems);
      return {};
    }

    console.log('Formatting grocery items for display:', groceryItems);

    // Process the flat list into categories
    const categorized = {};

    // First filter out null/undefined items
    const validItems = groceryItems.filter(item => item !== null && item !== undefined);

    validItems.forEach(item => {
      try {
        // Get the item name (handle both string and object formats)
        const itemName = typeof item === 'string' ? item : (item.name || '');
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
      } catch (error) {
        console.error(`Error processing grocery item: ${error}`, item);
        // Continue to next item instead of crashing
      }
    });

    // If we processed items but ended up with no categories, create a default "Other" category
    if (Object.keys(categorized).length === 0 && validItems.length > 0) {
      console.warn('Failed to categorize any items, using default category');
      categorized['Other'] = validItems.map(item => typeof item === 'string' ? item : (item.name || String(item)));
    }

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

      // TRY DIRECT MENU FIRST - This gives us the ingredient details with quantities
      try {
        console.log(`DIRECT APPROACH: Fetching menu details directly for ${selectedMenuId}`);
        const menuDetails = await apiService.getMenuDetails(selectedMenuId);
        console.log("DIRECT MENU DETAILS:", menuDetails);

        if (menuDetails && menuDetails.days && Array.isArray(menuDetails.days)) {
          console.log("SUCCESS: Direct menu details contains full menu data with days");

          // Process and set the grocery list directly from the menu data
          const categorizedItems = formatCategoriesForDisplay(menuDetails);
          console.log("Processed categorized items:", categorizedItems);

          setGroceryList(categorizedItems);
          setLoading(false);
          return; // Exit early as we have the data
        }
      } catch (directMenuErr) {
        console.error("Failed to get direct menu details:", directMenuErr);
      }

      // Try both endpoints to get the data we need
      let fetchedGroceryList = [];
      let menuDetails = null;
      let success = false;

      // Try DIRECT access to API using fetch instead of apiService
      try {
        console.log(`Strategy 1: Directly fetching grocery list for menu ${selectedMenuId}`);

        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No auth token in localStorage!');
          throw new Error('No auth token found');
        }

        // Direct fetch to the API - bypass apiService
        const directResponse = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/grocery-list`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!directResponse.ok) {
          throw new Error(`API error: ${directResponse.status}`);
        }

        const directResult = await directResponse.json();
        console.log("DIRECT RAW grocery list response:", directResult);

        // Add a global window variable to debug in browser console
        window.lastGroceryListResponse = directResult;
        console.log("Available in browser console as 'window.lastGroceryListResponse'");

        // Display first few items directly in the console for debugging
        if (Array.isArray(directResult) && directResult.length > 0) {
          console.log("FIRST 5 ITEMS:", directResult.slice(0, 5));
          directResult.slice(0, 5).forEach((item, i) => {
            console.log(`ITEM[${i}]:`, item);
            if (typeof item === 'object') {
              console.log(`Item keys: ${Object.keys(item)}`);
              console.log(`name: ${item.name}, quantity: ${item.quantity}`);
            }
          });
        } else if (directResult && directResult.groceryList && Array.isArray(directResult.groceryList)) {
          console.log("FIRST 5 ITEMS from groceryList:", directResult.groceryList.slice(0, 5));
        }

        // Handle different response structures
        if (directResult && Array.isArray(directResult)) {
          console.log("DIRECT: Using raw array:", directResult);
          setGroceryList(directResult);
          setLoading(false);
          return; // Exit early since we have the data
        } else if (directResult && directResult.groceryList && Array.isArray(directResult.groceryList)) {
          console.log("DIRECT: Using groceryList array:", directResult.groceryList);
          setGroceryList(directResult.groceryList);
          setLoading(false);
          return; // Exit early since we have the data
        }

        // Fall back to regular approach if direct fetch didn't produce a usable array
        const groceryListResponse = await apiService.getGroceryListByMenuId(selectedMenuId);
        console.log("Raw grocery list response from apiService:", groceryListResponse);

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

        // Make sure we're using the proper format expected by ShoppingList component
        // Check if the data is in the expected format (with name and quantity properties)
        const formattedList = fetchedGroceryList.map(item => {
          // If it's already an object with name property, use it
          if (typeof item === 'object' && item !== null && item.name) {
            // Ensure quantity is defined
            if (!item.quantity) {
              item.quantity = '1';
            }
            return item;
          }

          // If it's a string with a colon (like "Chicken Breast: 2 lb"), parse it
          if (typeof item === 'string' && item.includes(':')) {
            const parts = item.split(':');
            const name = parts[0].trim();
            const quantity = parts.length > 1 ? parts[1].trim() : '1';
            return { name, quantity };
          }

          // Otherwise just use the string as name
          return { name: String(item), quantity: '1' };
        });

        console.log("Formatted grocery list:", formattedList);
        setGroceryList(formattedList);
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
          // Format grocery list items to ensure they have proper name and quantity properties
          const formattedList = groceryList.map(item => {
            // If it's already an object with name property, use it
            if (typeof item === 'object' && item !== null && item.name) {
              // Ensure quantity is defined
              if (!item.quantity) {
                item.quantity = '1';
              }
              return item;
            }

            // If it's a string with a colon (like "Chicken Breast: 2 lb"), parse it
            if (typeof item === 'string' && item.includes(':')) {
              const parts = item.split(':');
              const name = parts[0].trim();
              const quantity = parts.length > 1 ? parts[1].trim() : '1';
              return { name, quantity };
            }

            // Otherwise just use the string as name
            return { name: String(item), quantity: '1' };
          });

          console.log("Formatted grocery list from menu history:", formattedList);
          setGroceryList(formattedList);
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
      // Clear current data and stop any active polling
      clearStatusPolling();
      setLoading(true);
      setAiShoppingData(null);
      setUsingAiList(false);

      console.log(`Manually selecting menu ID: ${menuId}`);

      // Set the new menu ID first - this will trigger useEffect to fetch data
      setSelectedMenuId(menuId);

      // Fetch grocery list directly for immediate display
      const groceryListResponse = await apiService.getGroceryListByMenuId(menuId);

      // Update grocery list with the new data
      if (groceryListResponse && groceryListResponse.groceryList) {
        // Ensure proper format with name and quantity properties
        const formattedList = groceryListResponse.groceryList.map(item => {
          // If it's already an object with name property, use it
          if (typeof item === 'object' && item !== null && item.name) {
            // Ensure quantity is defined
            if (!item.quantity) {
              item.quantity = '1';
            }
            return item;
          }

          // If it's a string with a colon (like "Chicken Breast: 2 lb"), parse it
          if (typeof item === 'string' && item.includes(':')) {
            const parts = item.split(':');
            const name = parts[0].trim();
            const quantity = parts.length > 1 ? parts[1].trim() : '1';
            return { name, quantity };
          }

          // Otherwise just use the string as name
          return { name: String(item), quantity: '1' };
        });

        console.log("Formatted grocery list after menu selection:", formattedList);
        setGroceryList(formattedList);
      }

      // Check if we have a cached AI list for this menu
      const cachedData = getCachedShoppingList(menuId);
      if (cachedData) {
        // Process and use cached data
        const processedCache = processAiShoppingItems({
          ...cachedData,
          cached: true,
          menuId: menuId
        });

        setAiShoppingData(processedCache);
        setUsingAiList(true);
        setActiveTab(1); // Switch to AI tab

        // Show notification
        showSnackbar(`Using cached shopping list for menu ${menuId}`);
      } else {
        // Show AI prompt for the new menu
        setShowAiShoppingPrompt(true);
      }
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
      if (!menuId) {
        console.log("No menu ID provided for cache lookup");
        return null;
      }

      // Convert menuId to string to ensure consistent key usage
      const menuIdStr = menuId.toString();

      const cacheString = localStorage.getItem(AI_SHOPPING_CACHE_KEY);
      if (!cacheString) return null;

      const cacheData = JSON.parse(cacheString);

      // Check if we have cached data for this menu
      if (!cacheData[menuIdStr]) {
        console.log(`No cache found for menu ID: ${menuIdStr}`);
        return null;
      }

      const menuCache = cacheData[menuIdStr];

      // Check if cache has expired
      const now = Date.now();
      if (now - menuCache.timestamp > CACHE_EXPIRY_MS) {
        console.log(`Shopping list cache expired for menu ${menuIdStr}`);
        // Remove expired cache
        delete cacheData[menuIdStr];
        localStorage.setItem(AI_SHOPPING_CACHE_KEY, JSON.stringify(cacheData));
        return null;
      }

      // Verify cached data is for the right menu
      if (menuCache.menuId && menuCache.menuId.toString() !== menuIdStr) {
        console.log(`Cache mismatch: found data for menu ${menuCache.menuId} but requested ${menuIdStr}`);
        return null;
      }

      console.log(`Found valid cached shopping list for menu ${menuIdStr}`);
      return menuCache.data;
    } catch (error) {
      console.error("Error reading cache:", error);
      return null;
    }
  };

  const setCachedShoppingList = (menuId, data) => {
    try {
      if (!menuId) {
        console.log("No menu ID provided for caching");
        return;
      }

      // Convert menuId to string for consistent key usage
      const menuIdStr = menuId.toString();

      // Get existing cache
      const cacheString = localStorage.getItem(AI_SHOPPING_CACHE_KEY);
      const cacheData = cacheString ? JSON.parse(cacheString) : {};

      // Update cache with new data and timestamp
      cacheData[menuIdStr] = {
        data: {
          ...data,
          menuId: menuId, // Store the menu ID in the data to verify later
        },
        menuId: menuIdStr, // Store in the cache entry too
        timestamp: Date.now(),
        preferences: aiPreferences || null
      };

      // Save updated cache
      localStorage.setItem(AI_SHOPPING_CACHE_KEY, JSON.stringify(cacheData));
      console.log(`Cached shopping list for menu ${menuIdStr}`);
    } catch (error) {
      console.error("Error writing cache:", error);
    }
  };
  
  // Status polling mechanism for AI shopping list
  const [statusPollingInterval, setStatusPollingInterval] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 60; // Maximum number of status checks (5 minutes at 5-second intervals)
  const POLL_INTERVAL = 5000; // Poll every 5 seconds

  // Process AI shopping list items function (moved outside to be reusable)
  const processAiShoppingItems = (response) => {
    // Safety check for null response
    if (!response) {
      console.error("Null response passed to processAiShoppingItems");
      return { groceryList: [], error: "Invalid response data" };
    }

    console.log("Processing AI shopping list items with response keys:", Object.keys(response));

    // Make a deep copy to avoid mutating the original response
    try {
      response = JSON.parse(JSON.stringify(response));
    } catch (error) {
      console.error("Error creating deep copy of response:", error);
      // Continue with the original response if copy fails
    }

    // Check if we have a direct groceryList or need to extract it from a different structure
    if (!response.groceryList && response.result && response.result.groceryList) {
      console.log("Found groceryList inside result property - extracting it");
      response.groceryList = response.result.groceryList;

      // Also extract other properties if they exist
      if (response.result.nutritionTips) response.nutritionTips = response.result.nutritionTips;
      if (response.result.recommendations) response.recommendations = response.result.recommendations;
      if (response.result.healthySwaps) response.healthySwaps = response.result.healthySwaps;
      if (response.result.pantryStaples) response.pantryStaples = response.result.pantryStaples;
    }

    // Handle case where groceryList might be a string (JSON)
    if (response.groceryList && typeof response.groceryList === 'string') {
      try {
        console.log("groceryList is a string, attempting to parse as JSON");
        response.groceryList = JSON.parse(response.groceryList);
      } catch (parseError) {
        console.error("Failed to parse groceryList string as JSON:", parseError);
      }
    }

    // Format and normalize all items to ensure quantities are shown
    if (response.groceryList && Array.isArray(response.groceryList)) {
      console.log(`Processing ${response.groceryList.length} AI shopping list categories`);

      response.groceryList.forEach(category => {
        // Skip null categories
        if (!category) return;

        // Handle malformed property names in categories
        // Check for properties like "car carbs" instead of "carbs"
        if (category) {
          Object.keys(category).forEach(key => {
            if (key.includes('carb') && key !== 'carbs') {
              console.log(`Found malformed carbs key: ${key}, fixing`);
              category.carbs = category[key];
            }

            if (key.includes('protein') && key !== 'protein') {
              console.log(`Found malformed protein key: ${key}, fixing`);
              category.protein = category[key];
            }

            if (key.includes('fat') && key !== 'fat') {
              console.log(`Found malformed fat key: ${key}, fixing`);
              category.fat = category[key];
            }
          });
        }

        if (category.items && Array.isArray(category.items)) {
          console.log(`Processing ${category.items.length} items in category ${category.category || 'unknown'}`);

          // Filter out null or undefined items first
          category.items = category.items.filter(item => item !== null && item !== undefined);

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
            else if (item && typeof item === "object") {
              // Check for malformed property names in the item
              if (item) {
                Object.keys(item).forEach(key => {
                  if (key.includes('carb') && key !== 'carbs') {
                    console.log(`Found malformed carbs key in item: ${key}, fixing`);
                    item.carbs = item[key];
                  }

                  if (key.includes('protein') && key !== 'protein') {
                    console.log(`Found malformed protein key in item: ${key}, fixing`);
                    item.protein = item[key];
                  }

                  if (key.includes('fat') && key !== 'fat') {
                    console.log(`Found malformed fat key in item: ${key}, fixing`);
                    item.fat = item[key];
                  }
                });
              }

              // Ensure name exists
              let name = item.name || "Unknown item";
              // Ensure quantity exists
              let quantity = item.quantity || "1";
              // Ensure unit exists
              let unit = item.unit || "";

              // Check if name contains quantity/unit information
              if (name.includes(': ') && !quantity) {
                // Split the name and quantity
                const parts = name.split(': ');
                if (parts.length >= 2) {
                  name = parts[0];
                  const quantityStr = parts[1];

                  // Try to extract quantity and unit using regex
                  const unitRegex = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/;
                  const unitMatch = quantityStr.match(unitRegex);

                  if (unitMatch) {
                    quantity = unitMatch[1];
                    if (unitMatch[2] && !unit) {
                      unit = unitMatch[2];
                    }
                  } else {
                    quantity = quantityStr;
                  }
                }
              }

              // Create or update display_name
              const display_name = `${name}: ${quantity}${unit ? ' ' + unit : ''}`.trim();

              return {
                ...item,
                name,
                quantity,
                unit,
                display_name
              };
            }
            // Safety fallback if item is unexpected type
            return {
              name: String(item),
              quantity: "1",
              unit: "",
              display_name: `${String(item)}: 1`
            };
          });
        }
      });
    }
    return response;
  };

  // Function to check the status of an AI shopping list
  // ENHANCED DIRECT FETCH - with proper categorization and unit conversion
  // Generate a brand new AI shopping list from scratch
  const generateNewAiList = async () => {
    // Reset state
    setGenerationLogs([]);
    setGenerationStats(null);
    setAiShoppingLoading(true);
    const startTime = new Date();

    // Define result variable to fix reference errors
    let result;

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
      // Assign to result to fix reference errors
      result = initialResult;
      addLog('Received initial response from API', 'success');

      // Log the entire response structure to debug
      addLog(`Response keys: ${Object.keys(initialResult).join(', ')}`, 'info');
      console.log("DEBUG Initial Response:", initialResult);

      // Log the raw data in a more readable format
      addLog(`Raw data: ${JSON.stringify(initialResult).substring(0, 500)}...`, 'info');

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
        const finalResult = await pollForResult() || initialResult;
        // Update result variable with finalResult to fix reference errors
        result = finalResult;
        addLog('Final response received', 'success');
        addLog(`Final data structure: ${Object.keys(finalResult).join(', ')}`, 'info');

        // Process the final result
        var processedResult = adaptShoppingListResponse(finalResult, selectedMenuId, addLog);
        console.log("PROCESSED DATA:", processedResult);
      } else {
        // We already have the final result
        addLog('Processing already complete - no polling needed', 'success');
        // Use initialResult as the final result
        result = initialResult;
        var processedResult = adaptShoppingListResponse(initialResult, selectedMenuId, addLog);
        console.log("PROCESSED DATA:", processedResult);
      }

      // Log a summary of what was generated
      try {
        // Log categories and counts
        if (result.categories && typeof result.categories === 'object') {
          const categoryCounts = Object.keys(result.categories).map(category =>
            `${category}: ${result.categories[category].length} items`
          );
          addLog(`Generated categories: ${categoryCounts.join(', ')}`, 'info');
        }

        // Log healthy alternatives if present
        if (result.healthyAlternatives && result.healthyAlternatives.length > 0) {
          addLog(`Found ${result.healthyAlternatives.length} healthy alternatives`, 'info');
        }

        // Log first few items as a sample of what was generated
        if (result.categories) {
          let sampleItems = [];
          for (const category in result.categories) {
            if (result.categories[category] && result.categories[category].length > 0) {
              const items = result.categories[category].slice(0, 2); // Take first 2 items from each category
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

      // Note: We already processed the result using our adapter above
      // Skip all the format checking since we're using the adapter now
      if (result.ingredient_list && Array.isArray(result.ingredient_list)) {
        // Format 1: ingredient_list array
        addLog(`Found ingredient_list array with ${result.ingredient_list.length} items`, 'info');

        // Convert to expected format with categories
        const categorized = {};

        // Try to categorize based on item properties if available
        result.ingredient_list.forEach(item => {
          const category = item.category || 'Other';
          if (!categorized[category]) {
            categorized[category] = [];
          }
          categorized[category].push(item.name || item);
        });

        processedResult = {
          categories: categorized,
          healthyAlternatives: result.healthyAlternatives || [],
          shoppingTips: result.shoppingTips || [],
          cached: false,
          timestamp: new Date().toISOString(),
          menuId: selectedMenuId
        };
      }
      else if (result.categories && typeof result.categories === 'object') {
        // Format 2: Already has categories object
        addLog(`Found categories object with ${Object.keys(result.categories).length} categories`, 'info');

        processedResult = {
          ...result,
          cached: false,
          timestamp: new Date().toISOString(),
          menuId: selectedMenuId
        };
      }
      else if (result.data && result.data.categories) {
        // Format 3: Data wrapped in data property
        addLog(`Found categories in data property`, 'info');

        processedResult = {
          ...result.data,
          cached: false,
          timestamp: new Date().toISOString(),
          menuId: selectedMenuId
        };
      }
      else if (Array.isArray(result)) {
        // Format 4: Direct array of items
        addLog(`Found direct array with ${result.length} items`, 'info');

        // Create a single category with all items
        processedResult = {
          categories: { 'All Items': result },
          healthyAlternatives: [],
          shoppingTips: [],
          cached: false,
          timestamp: new Date().toISOString(),
          menuId: selectedMenuId
        };
      }
      else {
        // Unknown format - log details and create a minimal valid structure
        addLog(`Unrecognized format - creating minimal structure`, 'warning');
        console.log('Unknown result format:', result);

        // Try extracting any arrays found in the result
        const allItems = [];
        Object.keys(result).forEach(key => {
          if (Array.isArray(result[key])) {
            addLog(`Found array in property "${key}" with ${result[key].length} items`, 'info');
            allItems.push(...result[key]);
          }
        });

        processedResult = {
          categories: { 'All Items': allItems.length > 0 ? allItems : ['No items found'] },
          healthyAlternatives: [],
          shoppingTips: [],
          cached: false,
          timestamp: new Date().toISOString(),
          menuId: selectedMenuId
        };
      }

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
        responseSize: JSON.stringify(result).length
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

  const directFetchShoppingList = async (menuId) => {
    console.log("DIRECT FETCH: Attempting direct API call to get shopping list for menu ID:", menuId);
    try {
      if (!menuId) {
        console.error("DIRECT FETCH ERROR: No menuId provided!");
        setAiShoppingLoading(false);
        return null;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        console.error("DIRECT FETCH ERROR: No auth token in localStorage!");
        setAiShoppingLoading(false);
        return null;
      }

      console.log("DIRECT FETCH: Making API request to:", `https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/grocery-list`);
      const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/grocery-list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error("DIRECT FETCH: API call failed", response.status);
        setAiShoppingLoading(false);
        return null;
      }

      const result = await response.json();
      console.log("DIRECT FETCH: Got shopping list directly:", result);

      // Add detailed logging to see what we're getting
      if (result && Array.isArray(result.ingredient_list || result.items)) {
        console.log("DIRECT FETCH: Found ingredient list with", (result.ingredient_list || result.items).length, "items");
      } else if (result && result.ingredient_list) {
        console.log("DIRECT FETCH: Found ingredient_list but it's not an array:", typeof result.ingredient_list);
      } else if (result && result.items) {
        console.log("DIRECT FETCH: Found items but it's not an array:", typeof result.items);
      } else {
        console.log("DIRECT FETCH: Response structure:", Object.keys(result).join(", "));
      }

      // Get the items from the response, handling different API response formats
      let items = [];

      // Try different properties where items might be found
      if (result?.ingredient_list && Array.isArray(result.ingredient_list)) {
        console.log("DIRECT FETCH: Using ingredient_list array");
        items = result.ingredient_list;
      } else if (result?.items && Array.isArray(result.items)) {
        console.log("DIRECT FETCH: Using items array");
        items = result.items;
      } else if (result?.groceryList && Array.isArray(result.groceryList)) {
        console.log("DIRECT FETCH: Using groceryList array");
        items = result.groceryList;
      } else if (Array.isArray(result)) {
        console.log("DIRECT FETCH: Using root array");
        items = result;
      } else if (result?.data && Array.isArray(result.data)) {
        console.log("DIRECT FETCH: Using data array");
        items = result.data;
      } else {
        // Last resort: try to extract from any object structure
        console.log("DIRECT FETCH: Trying deep scan for items");
        for (const key in result) {
          if (Array.isArray(result[key])) {
            console.log(`DIRECT FETCH: Found array in '${key}' with ${result[key].length} items`);
            if (result[key].length > 0) {
              items = result[key];
              break;
            }
          }
        }
      }

      if (!items || items.length === 0) {
        console.error("DIRECT FETCH: No items found in response");
        setAiShoppingLoading(false);
        return null;
      }

      console.log(`DIRECT FETCH: Processing ${items.length} items`);

      // Handle case where items are complex objects instead of strings
      items = items.map(item => {
        if (typeof item === 'string') {
          return item;
        } else if (item && typeof item === 'object') {
          if (item.name) return item.name;
          if (item.ingredient) return item.ingredient;
          return JSON.stringify(item);
        } else {
          return String(item);
        }
      });

      // Create category mapping for better organization
      const categories = {
        "Produce": [],
        "Protein": [],
        "Dairy": [],
        "Grains": [],
        "Pantry": [],
        "Other": []
      };

      // Helper function to categorize items
      const categorizeItem = (item) => {
        if (!item) return null;

        // Convert to string if not already
        const itemStr = typeof item === 'string' ? item : (item.name || String(item));
        if (!itemStr.trim()) return null;

        const itemLower = itemStr.toLowerCase();

        // Fix quantity units (especially for chicken breasts)
        let fixedItem = itemStr;

        // Check for unreasonably large quantities (like 96 lbs of chicken)
        const weightRegex = /(\d+)\s*(lb|lbs|pound|pounds)/i;
        const match = itemLower.match(weightRegex);

        if (match) {
          const quantity = parseInt(match[1], 10);
          // If quantity is very large for pounds (like 96 lbs)
          if (quantity > 10 && (
              itemLower.includes('chicken') ||
              itemLower.includes('breast') ||
              itemLower.includes('beef') ||
              itemLower.includes('steak') ||
              itemLower.includes('pork')
          )) {
            // Convert to ounces or more reasonable unit
            console.log(`Converting ${quantity} lbs to oz for ${itemStr}`);
            fixedItem = itemStr.replace(weightRegex, `${quantity} oz`);
          }
        }

        // Categorize based on keywords
        if (
          itemLower.includes('lettuce') ||
          itemLower.includes('spinach') ||
          itemLower.includes('carrot') ||
          itemLower.includes('broccoli') ||
          itemLower.includes('onion') ||
          itemLower.includes('garlic') ||
          itemLower.includes('pepper') ||
          itemLower.includes('cucumber') ||
          itemLower.includes('tomato') ||
          itemLower.includes('apple') ||
          itemLower.includes('banana') ||
          itemLower.includes('orange') ||
          itemLower.includes('berry') ||
          itemLower.includes('grape') ||
          itemLower.includes('fruit') ||
          itemLower.includes('vegetable')
        ) {
          categories["Produce"].push(fixedItem);
        }
        else if (
          itemLower.includes('chicken') ||
          itemLower.includes('beef') ||
          itemLower.includes('pork') ||
          itemLower.includes('fish') ||
          itemLower.includes('shrimp') ||
          itemLower.includes('salmon') ||
          itemLower.includes('meat') ||
          itemLower.includes('protein') ||
          itemLower.includes('steak') ||
          itemLower.includes('turkey') ||
          itemLower.includes('breast')
        ) {
          categories["Protein"].push(fixedItem);
        }
        else if (
          itemLower.includes('milk') ||
          itemLower.includes('cheese') ||
          itemLower.includes('yogurt') ||
          itemLower.includes('cream') ||
          itemLower.includes('butter') ||
          itemLower.includes('egg')
        ) {
          categories["Dairy"].push(fixedItem);
        }
        else if (
          itemLower.includes('bread') ||
          itemLower.includes('tortilla') ||
          itemLower.includes('pasta') ||
          itemLower.includes('rice') ||
          itemLower.includes('oat') ||
          itemLower.includes('quinoa') ||
          itemLower.includes('wheat') ||
          itemLower.includes('flour') ||
          itemLower.includes('cereal')
        ) {
          categories["Grains"].push(fixedItem);
        }
        else if (
          itemLower.includes('sugar') ||
          itemLower.includes('salt') ||
          itemLower.includes('spice') ||
          itemLower.includes('oil') ||
          itemLower.includes('sauce') ||
          itemLower.includes('condiment') ||
          itemLower.includes('vinegar') ||
          itemLower.includes('ketchup') ||
          itemLower.includes('mustard') ||
          itemLower.includes('syrup') ||
          itemLower.includes('baking') ||
          itemLower.includes('stock') ||
          itemLower.includes('broth')
        ) {
          categories["Pantry"].push(fixedItem);
        }
        else {
          categories["Other"].push(fixedItem);
        }

        return fixedItem;
      };

      // Process all items
      items.forEach(item => categorizeItem(item));

      // Filter out empty categories
      const filteredCategories = Object.entries(categories)
        .filter(([_, items]) => items.length > 0)
        .map(([category, items]) => ({
          category,
          items: items.map(item => ({
            name: item,
            display_name: item
          }))
        }));

      // If we somehow have no categories with items, just put everything in "Other"
      if (filteredCategories.length === 0 && items.length > 0) {
        filteredCategories.push({
          category: "All Items",
          items: items.map(item => ({
            name: typeof item === 'string' ? item : (item.name || String(item)),
            display_name: typeof item === 'string' ? item : (item.name || String(item))
          }))
        });
      }

      // Update state with categorized data
      setAiShoppingLoading(false);
      setAiShoppingData({
        groceryList: filteredCategories,
        menuId: menuId,
        status: "completed",
        cached: true,
        nutritionTips: [
          "Try to prioritize whole foods over processed options.",
          "Choose lean proteins for healthier meal options.",
          "Look for whole grain alternatives to refined grains."
        ],
        recommendations: [
          "Shop the perimeter of the store first for fresh foods.",
          "Check your pantry before shopping to avoid duplicates.",
          "Consider buying in-season produce for better flavor and value."
        ]
      });
      setActiveTab(1);
      setUsingAiList(true);

      // Cache the results
      setCachedShoppingList(menuId, {
        groceryList: filteredCategories,
        menuId: menuId,
        status: "completed",
        nutritionTips: [
          "Try to prioritize whole foods over processed options.",
          "Choose lean proteins for healthier meal options.",
          "Look for whole grain alternatives to refined grains."
        ],
        recommendations: [
          "Shop the perimeter of the store first for fresh foods.",
          "Check your pantry before shopping to avoid duplicates.",
          "Consider buying in-season produce for better flavor and value."
        ]
      });

      return true;
    } catch (error) {
      console.log("DIRECT FETCH: Error fetching shopping list:", error);
      setAiShoppingLoading(false);
    }
    return null;
  };

  const checkAiShoppingListStatus = async (menuId) => {
    console.log(`Checking AI shopping list status for menu ${menuId}...`);

    // Safety check - if no active polling interval, exit immediately
    if (!statusPollingInterval) {
      console.log("No active polling interval, skipping status check");
      return;
    }

    // Track current polling in a global variable to prevent duplicate calls
    if (window.aiStatusCurrentlyPolling) {
      console.log("Another status check is already in progress, skipping this one");
      return;
    }

    // Set the flag to indicate polling is in progress
    window.aiStatusCurrentlyPolling = true;

    console.log(`Polling AI shopping list status (attempt ${pollCount + 1}/${MAX_POLLS})`);

    // Exit conditions - no menu ID or max polls reached
    if (!menuId || pollCount >= MAX_POLLS) {
      // Stop polling if we've reached the maximum number of polls
      if (pollCount >= MAX_POLLS) {
        console.log(`Maximum polls (${MAX_POLLS}) reached, stopping status checks`);
        showSnackbar("AI processing is taking longer than expected. Please try refreshing the page.");
      } else {
        console.log("No menu ID provided, stopping polling");
      }
      clearStatusPolling();
      window.aiStatusCurrentlyPolling = false;
      return;
    }

    try {
      // Validate that this polling is for the expected menu
      if (window.currentPollingMenuId !== menuId) {
        console.log(`Menu ID mismatch: expected ${window.currentPollingMenuId}, got ${menuId}, stopping`);
        clearStatusPolling();
        window.aiStatusCurrentlyPolling = false;
        return;
      }

      // Fetch status from API
      const statusResponse = await apiService.getAiShoppingListStatus(menuId, aiPreferences);
      console.log("Status response:", statusResponse);

      // Increment poll count
      setPollCount(prevCount => prevCount + 1);

      // Log the full status response for debugging
      console.log("Status response for menu", menuId, ":", JSON.stringify(statusResponse));

      // Check if nutritionTips or recommendations contain processing placeholders
      const hasPlaceholderMessages =
        (statusResponse.nutritionTips &&
         Array.isArray(statusResponse.nutritionTips) &&
         statusResponse.nutritionTips.length > 0 &&
         (statusResponse.nutritionTips[0].includes("Check status endpoint") ||
          statusResponse.nutritionTips[0].includes("still processing"))) ||
        (statusResponse.recommendations &&
         Array.isArray(statusResponse.recommendations) &&
         statusResponse.recommendations.length > 0 &&
         (statusResponse.recommendations[0].includes("being processed") ||
          statusResponse.recommendations[0].includes("still processing")));

      console.log("Status response has placeholder messages:", hasPlaceholderMessages);

      // Check comprehensive completion conditions
      const isCompleted =
        // Explicitly marked as completed
        statusResponse.status === "completed" ||
        // Explicitly cached
        statusResponse.cached === true ||
        // Has groceryList with content AND no placeholder messages
        (statusResponse.groceryList &&
         Array.isArray(statusResponse.groceryList) &&
         statusResponse.groceryList.length > 0 &&
         !hasPlaceholderMessages) ||
        // Has nutritionTips with real content (no placeholders)
        (statusResponse.nutritionTips &&
         Array.isArray(statusResponse.nutritionTips) &&
         statusResponse.nutritionTips.length > 0 &&
         statusResponse.nutritionTips[0] !== "Please try again" &&
         !statusResponse.nutritionTips[0].includes("Check status endpoint") &&
         !statusResponse.nutritionTips[0].includes("still processing")) ||
        // Has recommendations with real content (no placeholders)
        (statusResponse.recommendations &&
         Array.isArray(statusResponse.recommendations) &&
         statusResponse.recommendations.length > 0 &&
         statusResponse.recommendations[0] !== "Error checking status" &&
         !statusResponse.recommendations[0].includes("being processed") &&
         !statusResponse.recommendations[0].includes("still processing"));

      if (isCompleted) {
        console.log("AI shopping list processing completed or using cached data!");

        // Stop the polling immediately (crucial step)
        clearStatusPolling();

        // Process the items with the helper function
        const processedResponse = processAiShoppingItems(statusResponse);

        // Update state with the completed data
        setAiShoppingData(processedResponse);
        setAiShoppingLoading(false);

        // Automatically switch to the AI tab
        setActiveTab(1);
        setUsingAiList(true);

        console.log("AI shopping list processed successfully - switching to AI tab");

        // Set a flag to track that this menu's list was successfully loaded
        window.menuAiShoppingListCompleted = window.menuAiShoppingListCompleted || {};
        window.menuAiShoppingListCompleted[menuId] = true;

        // Cache the results
        setCachedShoppingList(menuId, {
          ...processedResponse,
          menuId: menuId
        });

        // Only show completion message if we were actually polling for a while
        // This prevents multiple notifications when polling completes quickly
        if (pollCount > 1) {
          showSnackbar("AI shopping list is ready!");
        }

        // Clear any existing timeout to prevent race conditions
        if (window.aiStatusPollingTimeout) {
          clearTimeout(window.aiStatusPollingTimeout);
          window.aiStatusPollingTimeout = null;
        }

        // Set polling as no longer in progress
        window.aiStatusCurrentlyPolling = false;

        return; // Early exit - crucial to prevent further polling
      }

      // Handle "error" status
      else if (statusResponse.status === "error") {
        console.log("AI shopping list processing error:", statusResponse.message);

        // Stop the polling - this is crucial
        clearStatusPolling();

        // Show error message
        showSnackbar(`AI processing error: ${statusResponse.message || "Unknown error"}`);

        // Still update the data with what we got (might contain fallback data)
        const processedResponse = processAiShoppingItems(statusResponse);
        setAiShoppingData(processedResponse);
        setAiShoppingLoading(false);
      }
      // Handle "not found" status (processing hasn't started or cache expired)
      else if (statusResponse.status === "not_found" || statusResponse.status === "expired") {
        console.warn("AI processing status not found or expired");

        // Stop polling as there's nothing to poll for
        clearStatusPolling();

        // Notify user
        showSnackbar("AI processing not found. Please try again.");
        setAiShoppingLoading(false);
      }
      // For "processing" status, we continue polling until completion or max attempts
      else {
        console.log("AI shopping list still processing, continuing to poll...");
      }
    } catch (err) {
      console.error("Error checking AI shopping list status:", err);

      // Don't stop polling on most errors, just log it and continue
      // But if we fail 3 consecutive times, stop polling
      if (err.message && (err.message.includes("Network Error") || pollCount > 3)) {
        console.log("Network error or too many consecutive failures, stopping polling");
        clearStatusPolling();
        showSnackbar("Error checking shopping list status: " + err.message);
      }
    } finally {
      // Always clear the polling in progress flag
      window.aiStatusCurrentlyPolling = false;
    }
  };

  // Helper to clear the polling interval - enhanced for reliability
  const clearStatusPolling = () => {
    console.log("Clearing status polling interval - current interval:", statusPollingInterval);

    // Track that we're in the process of clearing
    window.isPollingBeingCleared = true;

    try {
      // Clear the interval safely with double check
      if (statusPollingInterval) {
        try {
          // First attempt to clear
          clearInterval(statusPollingInterval);
          console.log("Successfully cleared interval");
        } catch (intervalError) {
          console.error("Error clearing interval:", intervalError);
        }

        // Force state update to null, regardless of whether clearInterval succeeded
        setStatusPollingInterval(null);
      }

      // Clear any pending timeout for immediate check
      if (window.aiStatusPollingTimeout) {
        try {
          clearTimeout(window.aiStatusPollingTimeout);
          console.log("Successfully cleared timeout");
        } catch (timeoutError) {
          console.error("Error clearing timeout:", timeoutError);
        }
        window.aiStatusPollingTimeout = null;
      }

      // Reset all tracking variables
      window.currentPollingMenuId = null;
      window.aiStatusCurrentlyPolling = false;

      // Reset poll count
      setPollCount(0);

      // Set a guard flag to prevent multiple concurrent polling loops
      // This creates a "cooldown" period before allowing new polling to start
      window.isPollingCleared = true;

      // Clear any old timeouts for the flag reset
      if (window.pollingClearedResetTimeout) {
        clearTimeout(window.pollingClearedResetTimeout);
      }

      // After a short delay, reset the guard flag to allow new polling to start
      window.pollingClearedResetTimeout = setTimeout(() => {
        window.isPollingCleared = false;
        window.isPollingBeingCleared = false;
        console.log("Polling guards reset - new polling allowed");
      }, 1000); // Longer delay for safer operation
    } catch (error) {
      console.error("Global error in clearStatusPolling:", error);

      // Force reset of all polling state variables
      // Even if there was an error above, make sure we reset everything
      window.statusPollingInterval = null;
      window.aiStatusPollingTimeout = null;
      window.currentPollingMenuId = null;
      window.aiStatusCurrentlyPolling = false;

      setStatusPollingInterval(null);
      setPollCount(0);

      // Reset flags with delay
      setTimeout(() => {
        window.isPollingCleared = false;
        window.isPollingBeingCleared = false;
      }, 1000);
    }
  };

  // Function to start polling for status updates - enhanced for reliability
  const startStatusPolling = (menuId) => {
    // Validate menu ID
    if (!menuId) {
      console.warn("Cannot start polling without a valid menu ID");
      return;
    }

    // Store the menuId in state for tracking (not just in window)
    if (selectedMenuId !== menuId) {
      console.log(`Updating selectedMenuId to ${menuId} to ensure proper polling`);
      setSelectedMenuId(menuId);
    }

    // IMPORTANT: Set this global variable to track which menu we're polling
    window.currentPollingMenuId = menuId;

    // Log for debugging
    console.log(`Setting current polling menu ID to: ${menuId}`);

    // Reset the completed flag to make sure we poll properly
    if (window.menuAiShoppingListCompleted && window.menuAiShoppingListCompleted[menuId]) {
      console.log(`Resetting completion flag for menu ${menuId} to ensure proper polling`);
      window.menuAiShoppingListCompleted[menuId] = false;
    }

    // If another poll clear is in progress, wait before starting new polling
    if (window.isPollingBeingCleared) {
      console.log("Polling is being cleared, delaying new polling start");
      setTimeout(() => startStatusPolling(menuId), 1000);
      return;
    }

    // If polling cooldown is active, wait before starting
    if (window.isPollingCleared) {
      console.log("Polling cooldown active, delaying new polling start");
      setTimeout(() => startStatusPolling(menuId), 1200);
      return;
    }

    // Track the current menu ID being polled for validation
    window.currentPollingMenuId = menuId;

    // Always clear any existing polling first for safety
    // But only if we don't have an active clearing operation
    if (!window.isPollingBeingCleared) {
      clearStatusPolling();
    }

    // Reset poll count
    setPollCount(0);

    // Start a new polling interval
    console.log(`Starting status polling for menu ${menuId}`);

    try {
      // Check for cache before starting polling
      const cachedData = getCachedShoppingList(menuId);
      if (cachedData) {
        console.log(`Found cached shopping list for menu ${menuId}, not starting polling`);
        // Process cached data
        const processedCache = processAiShoppingItems({
          ...cachedData,
          cached: true,
          menuId: menuId
        });

        setAiShoppingData(processedCache);
        setUsingAiList(true);
        setAiShoppingLoading(false);

        // Track this menu as completed
        window.menuAiShoppingListCompleted = window.menuAiShoppingListCompleted || {};
        window.menuAiShoppingListCompleted[menuId] = true;

        // Show cached notification
        showSnackbar(`Using cached shopping list for menu ${menuId}`);
        return;
      }

      // Create and save the interval ID with built-in error handling
      const intervalId = setInterval(() => {
        try {
          // Skip if polling is paused or being cleared
          if (window.isPollingCleared || window.isPollingBeingCleared) {
            console.log("Polling is paused or being cleared, skipping this polling cycle");
            return;
          }

          // Validate that we're polling for the current menu
          if (window.currentPollingMenuId !== menuId) {
            console.log(`Menu ID mismatch detected (polling: ${menuId}, global: ${window.currentPollingMenuId})`);

            // Instead of stopping, update the global to match what we're currently polling
            if (menuId) {
              console.log(`Fixing by updating global polling ID to: ${menuId}`);
              window.currentPollingMenuId = menuId;
            } else if (window.currentPollingMenuId) {
              console.log(`Fixing by continuing to poll for ${window.currentPollingMenuId}`);
              // No need to stop - we'll continue with the globally tracked ID
            } else {
              console.log("No valid menu ID found for polling, stopping");
              clearStatusPolling();
              return;
            }
          }

          // Safety check to make sure polling doesn't continue after the component unmounts
          if (!statusPollingInterval) {
            console.log("Interval state variable is null, stopping polling");

            // Force cleanup any actual interval that might still be running
            if (intervalId) {
              console.log("Clearing interval ID directly:", intervalId);
              clearInterval(intervalId);
            }
            return;
          }

          // Check for completed status in a global variable to prevent unnecessary status checks
          if (window.menuAiShoppingListCompleted && window.menuAiShoppingListCompleted[menuId]) {
            console.log(`Menu ${menuId} already completed according to global flag, stopping polling`);
            clearStatusPolling();
            return;
          }

          // All checks passed, perform status check
          checkAiShoppingListStatus(menuId);
        } catch (intervalError) {
          console.error("Error in polling interval:", intervalError);
          clearStatusPolling();
        }
      }, POLL_INTERVAL);

      // Save the interval ID in state
      setStatusPollingInterval(intervalId);

      // Also track it in a global variable as backup
      window.activeStatusPollingInterval = intervalId;

      // Do an immediate check to start the process quickly - but use a timeout to ensure state updates have settled
      if (!window.aiStatusPollingTimeout) {
        window.aiStatusPollingTimeout = setTimeout(() => {
          if (!window.menuAiShoppingListCompleted || !window.menuAiShoppingListCompleted[menuId]) {
            console.log("Running immediate status check");
            checkAiShoppingListStatus(menuId);
          } else {
            console.log("Skipping immediate check - menu already completed");
          }
        }, 200);
      }
    } catch (error) {
      console.error("Error starting status polling:", error);
      clearStatusPolling();
    }
  };

  // Clean up interval on component mount and unmount with enhanced safety
  // Effect to rotate loading messages and handle timeout
  useEffect(() => {
    let messageInterval;
    let loadingTimeout;

    if (aiShoppingLoading) {
      console.log("Starting loading message rotation");
      // Start rotating messages
      messageInterval = setInterval(() => {
        setLoadingMessageIndex(prevIndex =>
          prevIndex >= loadingMessages.length - 1 ? 0 : prevIndex + 1
        );
      }, 3000);

      // Safety timeout - after 15 seconds, try the direct fetch as a fallback
      loadingTimeout = setTimeout(() => {
        console.log("Loading timeout reached (15s) - trying emergency fetch as fallback");

        // Show message to user
        showSnackbar("AI processing is taking longer than expected. Trying a faster approach...");

        // Use our simplified emergency fetch as a fallback
        try {
          // Get the token
          const token = localStorage.getItem('token');

          // Make a direct API call
          fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/grocery-list`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }
            return response.json();
          })
          .then(result => {
            console.log("TIMEOUT FALLBACK: Got shopping list:", result);

            // Basic item extraction
            let items = [];
            if (result.ingredient_list && Array.isArray(result.ingredient_list)) {
              items = result.ingredient_list;
            } else if (result.items && Array.isArray(result.items)) {
              items = result.items;
            } else if (Array.isArray(result)) {
              items = result;
            } else {
              // Try to find any array
              for (const key in result) {
                if (Array.isArray(result[key]) && result[key].length > 0) {
                  items = result[key];
                  break;
                }
              }
            }

            // Simple categorization
            const categories = {
              "Produce": [],
              "Protein": [],
              "Dairy": [],
              "Grains": [],
              "Other": []
            };

            // Process each item
            items.forEach(item => {
              const itemStr = typeof item === 'string' ? item :
                            (item && item.name ? item.name : String(item));

              const lowerItem = itemStr.toLowerCase();
              if (lowerItem.includes('chicken') || lowerItem.includes('beef') ||
                  lowerItem.includes('meat') || lowerItem.includes('fish')) {
                categories["Protein"].push(itemStr);
              } else if (lowerItem.includes('milk') || lowerItem.includes('cheese') ||
                        lowerItem.includes('egg') || lowerItem.includes('yogurt')) {
                categories["Dairy"].push(itemStr);
              } else if (lowerItem.includes('apple') || lowerItem.includes('banana') ||
                        lowerItem.includes('vegetable') || lowerItem.includes('tomato') ||
                        lowerItem.includes('lettuce') || lowerItem.includes('onion')) {
                categories["Produce"].push(itemStr);
              } else if (lowerItem.includes('bread') || lowerItem.includes('rice') ||
                        lowerItem.includes('pasta') || lowerItem.includes('cereal')) {
                categories["Grains"].push(itemStr);
              } else {
                categories["Other"].push(itemStr);
              }
            });

            // Format for display
            const formattedCategories = Object.entries(categories)
              .filter(([_, items]) => items.length > 0)
              .map(([category, items]) => ({
                category,
                items: items.map(item => ({
                  name: item,
                  display_name: item
                }))
              }));

            // Fallback for empty categories
            if (formattedCategories.length === 0 && items.length > 0) {
              formattedCategories.push({
                category: "All Items",
                items: items.map(item => ({
                  name: typeof item === 'string' ? item : (item.name || String(item)),
                  display_name: typeof item === 'string' ? item : (item.name || String(item))
                }))
              });
            }

            // Update state
            setAiShoppingLoading(false);
            setAiShoppingData({
              groceryList: formattedCategories,
              menuId: selectedMenuId,
              status: "completed",
              cached: true,
              nutritionTips: [
                "Try to prioritize whole foods over processed options.",
                "Choose lean proteins for healthier meal options."
              ],
              recommendations: [
                "Shop the perimeter of the store first for fresh foods.",
                "Check your pantry before shopping to avoid duplicates."
              ]
            });
            setActiveTab(1);
            setUsingAiList(true);
          })
          .catch(error => {
            console.error("TIMEOUT FALLBACK: Error fetching shopping list:", error);
            setAiShoppingLoading(false);

            // Show error data
            setAiShoppingData({
              groceryList: [{
                category: "All Items",
                items: [{ name: "Error fetching items", display_name: "Please try again" }]
              }],
              menuId: selectedMenuId,
              status: "error",
              cached: false,
              nutritionTips: ["Error fetching shopping list."],
              recommendations: ["Please try refreshing the page."]
            });
          });
        } catch (error) {
          console.error("TIMEOUT FALLBACK: Critical error:", error);
          setAiShoppingLoading(false);
        }
      }, 15000); // 15 seconds timeout
    }

    return () => {
      if (messageInterval) {
        console.log("Clearing loading message interval");
        clearInterval(messageInterval);
      }
      if (loadingTimeout) {
        console.log("Clearing loading timeout");
        clearTimeout(loadingTimeout);
      }
    };
  }, [aiShoppingLoading, loadingMessages.length, aiShoppingData, showSnackbar]);

  useEffect(() => {
    // Cleanup global state on mount to ensure no leftover polling from previous component instances
    clearStatusPolling();

    // Clear global tracking variables for completion status (this is a fresh mount)
    window.menuAiShoppingListCompleted = {};
    window.activeStatusPollingInterval = null;

    console.log("Component mounted, cleaned up previous polling state");

    // Enhanced cleanup on unmount
    return () => {
      console.log("Component unmounting, running comprehensive cleanup");

      // First, try the normal cleanup
      clearStatusPolling();

      // As an extra precaution, directly clear any interval in the React state
      if (statusPollingInterval) {
        try {
          clearInterval(statusPollingInterval);
          console.log("Cleared statusPollingInterval directly during unmount");
        } catch (e) {
          console.error("Error clearing interval during unmount:", e);
        }
      }

      // Also clear the backup global interval
      if (window.activeStatusPollingInterval) {
        try {
          clearInterval(window.activeStatusPollingInterval);
          console.log("Cleared global activeStatusPollingInterval during unmount");
        } catch (e) {
          console.error("Error clearing global interval during unmount:", e);
        }
        window.activeStatusPollingInterval = null;
      }

      // Clear all possible timeouts
      if (window.aiStatusPollingTimeout) {
        clearTimeout(window.aiStatusPollingTimeout);
        window.aiStatusPollingTimeout = null;
      }

      if (window.pollingClearedResetTimeout) {
        clearTimeout(window.pollingClearedResetTimeout);
        window.pollingClearedResetTimeout = null;
      }

      // Reset all flags and tracking variables
      window.isPollingCleared = false;
      window.isPollingBeingCleared = false;
      window.aiStatusCurrentlyPolling = false;
      window.currentPollingMenuId = null;

      console.log("Component unmount cleanup completed");
    };
  }, []);

  // Enhanced function to load AI shopping list with improved caching and error handling
  const loadAiShoppingList = async (menuId, forceRefresh = false) => {
    if (!menuId) {
      console.warn("Cannot load AI shopping list without a valid menu ID");
      return null;
    }

    // Set loading state
    setAiShoppingLoading(true);

    // Track that we're actively loading this menu's shopping list
    window.currentLoadingMenuId = menuId;

    try {
      // If we already know this menu's AI shopping list is completed, use the cached result
      if (window.menuAiShoppingListCompleted && window.menuAiShoppingListCompleted[menuId] && !forceRefresh) {
        console.log(`Menu ${menuId} already marked complete, using existing data`);

        // Get the cached data
        const cachedData = getCachedShoppingList(menuId);
        if (cachedData) {
          const processedCache = processAiShoppingItems({
            ...cachedData,
            cached: true,
            menuId: menuId
          });

          setAiShoppingData(processedCache);
          setUsingAiList(true);
          setAiShoppingLoading(false);

          showSnackbar(`Using cached shopping list for menu ${menuId}`);
          return processedCache;
        }
      }

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = getCachedShoppingList(menuId);
        if (cachedData) {
          console.log("Using cached AI shopping list for menu", menuId);

          // Process cached data to ensure all items are properly formatted
          const processedCache = processAiShoppingItems({
            ...cachedData,
            cached: true,
            menuId: menuId
          });

          // Mark this menu as completed
          window.menuAiShoppingListCompleted = window.menuAiShoppingListCompleted || {};
          window.menuAiShoppingListCompleted[menuId] = true;

          setAiShoppingData(processedCache);
          setUsingAiList(true);
          setAiShoppingLoading(false);

          // Show snackbar to indicate cached data is being used
          showSnackbar(`Using cached shopping list for menu ${menuId}`);

          return processedCache;
        }
      }

      // No cache or refresh requested, make API call
      console.log(`Requesting AI shopping list for menu ${menuId}`);

      try {
        // The API call logic has been moved to the handleApiResponse function
        // Just call the helper function from here
      } catch (apiError) {
        console.error("Error in AI shopping list generation:", apiError);
        showSnackbar(`Error generating AI shopping list: ${apiError.message}. Using standard list.`);

        // Note: The fallback attempt will happen in handleApiResponse
        // No need to duplicate it here
      }

      // Helper function to handle API responses in this function's scope
      async function handleApiResponse() {
        try {
          // First request to the POST endpoint for AI shopping list which starts the process in the background
          console.log("Initial POST request to start AI shopping list generation");
          const initialResponse = await apiService.generateAiShoppingList(menuId, aiPreferences, !forceRefresh);
          console.log("Initial AI shopping list response:", initialResponse);

          // Check if response has "processing" status or contains placeholder messages
          const hasProcessingStatus = initialResponse.status === "processing" || initialResponse.status === "pending";
          const hasPlaceholderMessages =
            (initialResponse.nutritionTips &&
             Array.isArray(initialResponse.nutritionTips) &&
             initialResponse.nutritionTips.length > 0 &&
             (initialResponse.nutritionTips[0].includes("Check status endpoint") ||
              initialResponse.nutritionTips[0].includes("still processing"))) ||
            (initialResponse.recommendations &&
             Array.isArray(initialResponse.recommendations) &&
             initialResponse.recommendations.length > 0 &&
             (initialResponse.recommendations[0].includes("being processed") ||
              initialResponse.recommendations[0].includes("still processing")));

          if (hasProcessingStatus || hasPlaceholderMessages) {
            console.log("Shopping list is being processed in the background, starting polling");
            console.log("Processing status:", hasProcessingStatus);
            console.log("Has placeholder messages:", hasPlaceholderMessages);

            // Set loading state to true to show the entertaining messages
            setAiShoppingLoading(true);

            // Start polling for status updates
            startStatusPolling(menuId);

            // Always switch to the AI tab when processing starts
            setActiveTab(1);

            // Return the initial processing response - but don't treat it as final
            // We'll update with the completed result when polling completes
            return initialResponse;
          }

          // If we got an immediate result (maybe cached), use it directly
          const aiResponse = initialResponse;
          console.log("Got immediate AI shopping list response:", aiResponse);

          // Validate response has required data
          if (!aiResponse) {
            throw new Error("Empty response from AI shopping list service");
          }

          // Check for explicit error message
          if (aiResponse.error) {
            console.warn("API returned error:", aiResponse.error);
            showSnackbar(`Error: ${aiResponse.error}. Using standard list.`);

            // If there's no grocery list data, don't switch to AI view
            if (!aiResponse.groceryList ||
                (Array.isArray(aiResponse.groceryList) && aiResponse.groceryList.length === 0)) {
              setUsingAiList(false);
              setAiShoppingLoading(false);
              return null;
            }
          }

          // Add default values for missing fields to ensure consistent data structure
          const enhancedResponse = {
            ...aiResponse,
            menuId: menuId,
            recommendations: aiResponse.recommendations || ["Shop by category to save time in the store"],
            nutritionTips: aiResponse.nutritionTips || ["Focus on whole foods for better nutrition"],
            healthySwaps: aiResponse.healthySwaps || [],
            pantryStaples: aiResponse.pantryStaples || ["Salt", "Pepper", "Olive Oil"]
          };

          return enhancedResponse;
        } catch (error) {
          console.error("Error in handleApiResponse:", error);

          // Try status endpoint as fallback
          console.log("Trying status endpoint as fallback");
          try {
            const statusResponse = await apiService.getAiShoppingListStatus(menuId, aiPreferences);
            console.log("Status response:", statusResponse);

            // Check if response contains placeholder messages
            const hasPlaceholderMessages =
              (statusResponse.nutritionTips &&
               Array.isArray(statusResponse.nutritionTips) &&
               statusResponse.nutritionTips.length > 0 &&
               (statusResponse.nutritionTips[0].includes("Check status endpoint") ||
                statusResponse.nutritionTips[0].includes("still processing"))) ||
              (statusResponse.recommendations &&
               Array.isArray(statusResponse.recommendations) &&
               statusResponse.recommendations.length > 0 &&
               (statusResponse.recommendations[0].includes("being processed") ||
                statusResponse.recommendations[0].includes("still processing")));

            const isReallyCached =
              statusResponse.cached === true ||
              statusResponse.status === "completed";

            const hasRealData =
              (statusResponse.groceryList &&
               Array.isArray(statusResponse.groceryList) &&
               statusResponse.groceryList.length > 0 &&
               !hasPlaceholderMessages);

            if (isReallyCached || hasRealData) {
              // We have a truly completed result via status endpoint
              console.log("Status endpoint returned a completed result");
              return statusResponse;
            } else {
              // Start polling if status indicates processing
              if (statusResponse.status === "processing" || hasPlaceholderMessages) {
                console.log("Status endpoint indicates processing - starting polling");
                // Set loading state to true to show the entertaining messages
                setAiShoppingLoading(true);

                // Start polling for status updates
                startStatusPolling(menuId);

                // Always switch to the AI tab when processing starts
                setActiveTab(1);
                return statusResponse;
              }
            }
          } catch (statusError) {
            console.error("Status endpoint also failed:", statusError);
          }

          return null;
        }
      }

      // Get the response data
      const responseData = await handleApiResponse();

      // If we got null or undefined, return early
      if (!responseData) {
        console.log("No valid shopping list data received");
        setAiShoppingLoading(false);
        return null;
      }

      // Process the items to ensure proper formatting
      const processedResponse = processAiShoppingItems(responseData);

      // Update state with the response data
      setAiShoppingData(processedResponse);
      setUsingAiList(true);

      // Automatically switch to the AI tab when data is available
      setActiveTab(1); // Switch to AI tab

      // Check for conditions that indicate a completed shopping list
      // Log the processed response for debugging
      console.log("Processing AI response to check completion:", JSON.stringify(processedResponse));

      // Check if nutritionTips or recommendations contain processing placeholders
      const hasPlaceholderMessages =
        (processedResponse.nutritionTips &&
         Array.isArray(processedResponse.nutritionTips) &&
         processedResponse.nutritionTips.length > 0 &&
         (processedResponse.nutritionTips[0].includes("Check status endpoint") ||
          processedResponse.nutritionTips[0].includes("still processing"))) ||
        (processedResponse.recommendations &&
         Array.isArray(processedResponse.recommendations) &&
         processedResponse.recommendations.length > 0 &&
         (processedResponse.recommendations[0].includes("being processed") ||
          processedResponse.recommendations[0].includes("still processing")));

      console.log("Response has placeholder messages:", hasPlaceholderMessages);

      // Only consider it completed if status is explicit or there are no placeholder messages
      const isCompleted =
        // Explicitly marked as completed
        processedResponse.status === "completed" ||
        // Explicitly cached
        processedResponse.cached === true ||
        // Has groceryList with content AND no placeholder messages
        (processedResponse.groceryList &&
         Array.isArray(processedResponse.groceryList) &&
         processedResponse.groceryList.length > 0 &&
         !hasPlaceholderMessages) ||
        // Has nutritionTips with real content (no placeholders)
        (processedResponse.nutritionTips &&
         Array.isArray(processedResponse.nutritionTips) &&
         processedResponse.nutritionTips.length > 0 &&
         processedResponse.nutritionTips[0] !== "Please try again" &&
         !processedResponse.nutritionTips[0].includes("Check status endpoint") &&
         !processedResponse.nutritionTips[0].includes("still processing")) ||
        // Has recommendations with real content (no placeholders)
        (processedResponse.recommendations &&
         Array.isArray(processedResponse.recommendations) &&
         processedResponse.recommendations.length > 0 &&
         !processedResponse.recommendations[0].includes("being processed") &&
         !processedResponse.recommendations[0].includes("still processing"));

      console.log("AI shopping list completion status:", isCompleted);

      // If the response is already complete, no need to poll
      if (isCompleted) {
        console.log("AI shopping list response indicates completion, no polling needed");

        // Mark as completed
        window.menuAiShoppingListCompleted = window.menuAiShoppingListCompleted || {};
        window.menuAiShoppingListCompleted[menuId] = true;

        setAiShoppingLoading(false);

        // Cache the successful response
        setCachedShoppingList(menuId, {
          ...processedResponse,
          menuId: menuId
        });

        return processedResponse;
      }
      // Check if the response indicates processing is still happening
      else if (processedResponse.status === "processing" || processedResponse.status === "pending") {
        console.log("AI shopping list is being processed, starting status polling");

        // Make sure we're not already polling
        if (!statusPollingInterval) {
          // Start polling for processing status
          startStatusPolling(menuId);
        } else {
          console.log("Status polling already active, not starting another one");
        }
      } else {
        // No explicit status but also not clearly completed - set loading to false
        console.log("AI shopping list status unclear, using as-is without polling");
        setAiShoppingLoading(false);
      }

      return processedResponse;
    } catch (err) {
      console.error("Error generating AI shopping list:", err);
      showSnackbar("Error generating AI shopping list. Using standard list instead.");
      setUsingAiList(false);
      setAiShoppingLoading(false);
      return null;
    } finally {
      // Clear the tracking variable
      if (window.currentLoadingMenuId === menuId) {
        window.currentLoadingMenuId = null;
      }
    }
  };

  // Handler for AI prompt dialog
  const handleAiPromptResponse = async (useAi) => {
    setShowAiShoppingPrompt(false);

    if (useAi) {
      // User chose AI shopping list - use our simplified approach
      setAiShoppingLoading(true);

      // Use the same emergency function to fetch directly
      try {
        // Get the token
        const token = localStorage.getItem('token');

        // Direct API call with minimal processing
        const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/grocery-list`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Basic error handling
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Parse the response
        const result = await response.json();
        console.log("AI PROMPT: Got shopping list:", result);

        // Very basic item extraction - get anything we can find
        let items = [];
        if (result.ingredient_list && Array.isArray(result.ingredient_list)) {
          items = result.ingredient_list;
        } else if (result.items && Array.isArray(result.items)) {
          items = result.items;
        } else if (Array.isArray(result)) {
          items = result;
        } else {
          // Last attempt - get any array from the response
          for (const key in result) {
            if (Array.isArray(result[key]) && result[key].length > 0) {
              items = result[key];
              break;
            }
          }
        }

        // Create very simple categories
        const categories = {
          "Produce": [],
          "Protein": [],
          "Dairy": [],
          "Grains": [],
          "Other": []
        };

        // Process each item minimally
        items.forEach(item => {
          // Get the item as a string
          const itemStr = typeof item === 'string' ? item :
                        (item && item.name ? item.name : String(item));

          // Very basic categorization
          const lowerItem = itemStr.toLowerCase();
          if (lowerItem.includes('chicken') || lowerItem.includes('beef') ||
              lowerItem.includes('meat') || lowerItem.includes('fish')) {
            categories["Protein"].push(itemStr);
          } else if (lowerItem.includes('milk') || lowerItem.includes('cheese') ||
                    lowerItem.includes('egg') || lowerItem.includes('yogurt')) {
            categories["Dairy"].push(itemStr);
          } else if (lowerItem.includes('apple') || lowerItem.includes('banana') ||
                    lowerItem.includes('vegetable') || lowerItem.includes('tomato') ||
                    lowerItem.includes('lettuce') || lowerItem.includes('onion')) {
            categories["Produce"].push(itemStr);
          } else if (lowerItem.includes('bread') || lowerItem.includes('rice') ||
                    lowerItem.includes('pasta') || lowerItem.includes('cereal')) {
            categories["Grains"].push(itemStr);
          } else {
            categories["Other"].push(itemStr);
          }
        });

        // Format for the UI
        const formattedCategories = Object.entries(categories)
          .filter(([_, items]) => items.length > 0)
          .map(([category, items]) => ({
            category,
            items: items.map(item => ({
              name: item,
              display_name: item
            }))
          }));

        // If we got nothing, create a single category with all items
        if (formattedCategories.length === 0 && items.length > 0) {
          formattedCategories.push({
            category: "All Items",
            items: items.map(item => ({
              name: typeof item === 'string' ? item : (item.name || String(item)),
              display_name: typeof item === 'string' ? item : (item.name || String(item))
            }))
          });
        }

        // Update state with our simple data
        setAiShoppingLoading(false);
        setAiShoppingData({
          groceryList: formattedCategories,
          menuId: selectedMenuId,
          status: "completed",
          cached: true,
          nutritionTips: [
            "Try to prioritize whole foods over processed options.",
            "Choose lean proteins for healthier meal options."
          ],
          recommendations: [
            "Shop the perimeter of the store first for fresh foods.",
            "Check your pantry before shopping to avoid duplicates."
          ]
        });
        setActiveTab(1);
        setUsingAiList(true);
      } catch (error) {
        console.error("AI PROMPT: Error fetching shopping list:", error);
        setAiShoppingLoading(false);

        // Even if we fail, provide some data to show something
        setAiShoppingData({
          groceryList: [{
            category: "All Items",
            items: [{ name: "Error fetching items", display_name: "Please try again" }]
          }],
          menuId: selectedMenuId,
          status: "error",
          cached: false,
          nutritionTips: ["Error fetching shopping list."],
          recommendations: ["Please try refreshing the page."]
        });
      }
    } else {
      // User chose standard shopping list
      setUsingAiList(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    console.log(`Selected menu changed to: ${selectedMenuId}`);

    // Reset AI data when menu changes to avoid showing previous menu's items
    if (selectedMenuId) {
      // Clear previous AI data and loading state
      setAiShoppingData(null);
      setUsingAiList(false);
      setAiShoppingLoading(false);

      // Clear any existing polling when menu changes
      clearStatusPolling();
    }

    // Fetch new shopping list data for the selected menu
    fetchShoppingListData();

    // Check if we have a cached AI shopping list for this menu
    if (selectedMenuId) {
      const cachedData = getCachedShoppingList(selectedMenuId);

      if (cachedData) {
        // Validate that the cached data matches this menu ID
        if (cachedData.menuId && cachedData.menuId.toString() === selectedMenuId.toString()) {
          console.log(`Using cached shopping list data for menu ${selectedMenuId}`);

          // Make sure cached data has cached flag set
          const processedCache = processAiShoppingItems({
            ...cachedData,
            cached: true,
            menuId: selectedMenuId
          });

          setAiShoppingData(processedCache);
          setUsingAiList(true);
          setActiveTab(1); // Switch to AI tab if we have cached data
          setAiShoppingLoading(false); // Ensure loading is turned off

          // Show a toast notification that we're using cached data
          showSnackbar(`Using cached shopping list for menu ${selectedMenuId}`);
        } else {
          console.log(`Cached data available but menu ID mismatch. Cache: ${cachedData.menuId}, Selected: ${selectedMenuId}`);
          // Wrong menu data in cache, don't use it
          setAiShoppingData(null);
          if (!showAiShoppingPrompt) {
            setShowAiShoppingPrompt(true);
          }
        }
      } else if (!showAiShoppingPrompt && !aiShoppingData) {
        // No cache, show AI prompt
        setShowAiShoppingPrompt(true);
      }
    }
  }, [user, selectedMenuId]);

const categorizeItems = (mealPlanData) => {
  // Safety check for null input
  if (!mealPlanData) {
    console.warn("Null meal plan data passed to categorizeItems");
    return { "No Items Found": [] };
  }

  let ingredientsList = [];
  console.log("Categorizing items from data:", mealPlanData);

  // Handle case where we get a groceryList array directly
  if (mealPlanData && mealPlanData.groceryList && Array.isArray(mealPlanData.groceryList)) {
    console.log("Using groceryList property directly:", mealPlanData.groceryList);
    // Filter out null/undefined items for safety
    const validItems = mealPlanData.groceryList.filter(item => item !== null && item !== undefined);
    return { "All Items": validItems };
  }

  // First, determine the structure of the input data
  if (Array.isArray(mealPlanData)) {
    // If it's already a direct list of ingredients
    console.log("Data is an array, using directly");
    // Filter out null/undefined items for safety
    ingredientsList = mealPlanData.filter(item => item !== null && item !== undefined);
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

      // Filter out null/undefined days for safety
      const validDays = mealPlan.days.filter(day => day !== null && day !== undefined);

      validDays.forEach(day => {
        try {
          // Fixing property names in day objects
          if (day) {
            // Fix malformed macro property names
            Object.keys(day).forEach(key => {
              if (key.includes('carb') && key !== 'carbs') {
                console.log(`Found malformed carbs key in day: ${key}, fixing`);
                day.carbs = day[key];
              }
              if (key.includes('protein') && key !== 'protein') {
                console.log(`Found malformed protein key in day: ${key}, fixing`);
                day.protein = day[key];
              }
              if (key.includes('fat') && key !== 'fat') {
                console.log(`Found malformed fat key in day: ${key}, fixing`);
                day.fat = day[key];
              }
            });
          }

          // Process meals
          if (day.meals && Array.isArray(day.meals)) {
            // Filter out null/undefined meals for safety
            const validMeals = day.meals.filter(meal => meal !== null && meal !== undefined);

            validMeals.forEach(meal => {
              try {
                // Fix malformed property names in meal objects
                if (meal) {
                  Object.keys(meal).forEach(key => {
                    if (key.includes('carb') && key !== 'carbs') {
                      console.log(`Found malformed carbs key in meal: ${key}, fixing`);
                      meal.carbs = meal[key];
                    }
                    if (key.includes('protein') && key !== 'protein') {
                      console.log(`Found malformed protein key in meal: ${key}, fixing`);
                      meal.protein = meal[key];
                    }
                    if (key.includes('fat') && key !== 'fat') {
                      console.log(`Found malformed fat key in meal: ${key}, fixing`);
                      meal.fat = meal[key];
                    }
                  });
                }

                if (meal.ingredients && Array.isArray(meal.ingredients)) {
                  console.log(`Found ${meal.ingredients.length} ingredients in meal: ${meal.title || 'Unnamed'}`);

                  // Filter out null/undefined ingredients for safety
                  const validIngredients = meal.ingredients.filter(ing => ing !== null && ing !== undefined);

                  try {
                    const processedIngredients = validIngredients.map(ing => {
                      try {
                        if (typeof ing === 'string') return ing.trim();

                        // Handle ingredient objects with malformed property names
                        if (ing && typeof ing === 'object') {
                          Object.keys(ing).forEach(key => {
                            if (key.includes('carb') && key !== 'carbs') {
                              console.log(`Found malformed carbs key in ingredient: ${key}, fixing`);
                              ing.carbs = ing[key];
                            }
                            if (key.includes('protein') && key !== 'protein') {
                              console.log(`Found malformed protein key in ingredient: ${key}, fixing`);
                              ing.protein = ing[key];
                            }
                            if (key.includes('fat') && key !== 'fat') {
                              console.log(`Found malformed fat key in ingredient: ${key}, fixing`);
                              ing.fat = ing[key];
                            }
                          });
                        }

                        return `${ing.quantity || ''} ${ing.name || ''}`.trim();
                      } catch (itemErr) {
                        console.error("Error processing ingredient item:", itemErr);
                        return "";
                      }
                    }).filter(ing => ing && ing.length > 0);

                    ingredientsList.push(...processedIngredients);
                  } catch (mapErr) {
                    console.error("Error mapping ingredients:", mapErr);
                  }
                }
              } catch (mealErr) {
                console.error("Error processing meal:", mealErr);
              }
            });
          }

          // Process snacks
          if (day.snacks && Array.isArray(day.snacks)) {
            // Filter out null/undefined snacks for safety
            const validSnacks = day.snacks.filter(snack => snack !== null && snack !== undefined);

            validSnacks.forEach(snack => {
              try {
                // Fix malformed property names in snack objects
                if (snack) {
                  Object.keys(snack).forEach(key => {
                    if (key.includes('carb') && key !== 'carbs') {
                      console.log(`Found malformed carbs key in snack: ${key}, fixing`);
                      snack.carbs = snack[key];
                    }
                    if (key.includes('protein') && key !== 'protein') {
                      console.log(`Found malformed protein key in snack: ${key}, fixing`);
                      snack.protein = snack[key];
                    }
                    if (key.includes('fat') && key !== 'fat') {
                      console.log(`Found malformed fat key in snack: ${key}, fixing`);
                      snack.fat = snack[key];
                    }
                  });
                }

                // Handle both snack formats (object with ingredients or simple object)
                if (snack.ingredients && Array.isArray(snack.ingredients)) {
                  console.log(`Found ${snack.ingredients.length} ingredients in snack: ${snack.title || 'Unnamed'}`);

                  // Filter out null/undefined ingredients for safety
                  const validIngredients = snack.ingredients.filter(ing => ing !== null && ing !== undefined);

                  try {
                    const processedIngredients = validIngredients.map(ing => {
                      try {
                        if (typeof ing === 'string') return ing.trim();

                        // Handle ingredient objects with malformed property names
                        if (ing && typeof ing === 'object') {
                          Object.keys(ing).forEach(key => {
                            if (key.includes('carb') && key !== 'carbs') {
                              console.log(`Found malformed carbs key in ingredient: ${key}, fixing`);
                              ing.carbs = ing[key];
                            }
                            if (key.includes('protein') && key !== 'protein') {
                              console.log(`Found malformed protein key in ingredient: ${key}, fixing`);
                              ing.protein = ing[key];
                            }
                            if (key.includes('fat') && key !== 'fat') {
                              console.log(`Found malformed fat key in ingredient: ${key}, fixing`);
                              ing.fat = ing[key];
                            }
                          });
                        }

                        return `${ing.quantity || ''} ${ing.name || ''}`.trim();
                      } catch (itemErr) {
                        console.error("Error processing ingredient item:", itemErr);
                        return "";
                      }
                    }).filter(ing => ing && ing.length > 0);

                    ingredientsList.push(...processedIngredients);
                  } catch (mapErr) {
                    console.error("Error mapping ingredients:", mapErr);
                  }
                } else if (snack.title && snack.quantity) {
                  // This is for snacks in the format { title, quantity, ... } without ingredients array
                  console.log(`Found simple snack: ${snack.title}`);
                  const snackItem = `${snack.quantity || ''} ${snack.title || ''}`.trim();
                  if (snackItem.length > 0) {
                    ingredientsList.push(snackItem);
                  }
                }
              } catch (snackErr) {
                console.error("Error processing snack:", snackErr);
              }
            });
          }
        } catch (dayErr) {
          console.error("Error processing day:", dayErr);
        }
      });
    }
  }

  // If ingredientsList is still empty but we have a groceryList somewhere in the data
  if (ingredientsList.length === 0 && typeof mealPlanData === 'object') {
    // Try to find a groceryList in a nested property
    const findGroceryList = (obj, depth = 0) => {
      if (!obj || depth > 3) return null; // Limit depth to avoid infinite recursion

      if (obj && obj.groceryList && Array.isArray(obj.groceryList)) {
        return obj.groceryList;
      }

      for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object') {
          const result = findGroceryList(obj[key], depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    try {
      const foundList = findGroceryList(mealPlanData);
      if (foundList) {
        console.log("Found groceryList in nested property:", foundList);
        // Filter out null/undefined items for safety
        ingredientsList = foundList.filter(item => item !== null && item !== undefined);
        console.log("Found groceryList with items:", ingredientsList.length);
      }
    } catch (findErr) {
      console.error("Error finding grocery list:", findErr);
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

    try {
      const parts = quantityStr.split(/\s+/);
      let total = 0;

      parts.forEach(part => {
        if (part.includes('/')) {
          const fractionParts = part.split('/');
          if (fractionParts.length === 2) {
            const num = parseFloat(fractionParts[0]);
            const denom = parseFloat(fractionParts[1]);
            if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
              total += num / denom;
            }
          }
        } else {
          const num = parseFloat(part);
          if (!isNaN(num)) {
            total += num;
          }
        }
      });

      return total || 1;
    } catch (error) {
      console.error("Error parsing quantity:", error);
      return 1;
    }
  };

  // Helper function to combine multiple quantities
  const combineQuantities = (quantityStr) => {
    try {
      if (!quantityStr) {
        return { quantity: 1, unit: '' };
      }

      const parts = quantityStr.split(/\s+/);
      let totalQuantity = 0;
      let lastUnit = '';

      for (let i = 0; i < parts.length; i++) {
        const num = parseFloat(parts[i]);
        if (!isNaN(num)) {
          // Make sure we don't go out of bounds
          const nextPart = i + 1 < parts.length ? parts[i + 1] : null;
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

      return { quantity: totalQuantity || 1, unit: lastUnit };
    } catch (error) {
      console.error("Error combining quantities:", error);
      return { quantity: 1, unit: '' };
    }
  };

  // Helper function to guess the most appropriate unit
  const guessAppropriateUnit = (itemName, currentUnit) => {
    try {
      if (!itemName) return '';

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

      if (currentUnit && (
          STANDARD_UNITS.volume.includes(currentUnit) ||
          STANDARD_UNITS.weight.includes(currentUnit) ||
          STANDARD_UNITS.count.includes(currentUnit) ||
          STANDARD_UNITS.special.includes(currentUnit))) {
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
    } catch (error) {
      console.error("Error guessing appropriate unit:", error);
      return '';
    }
  };

  // Process and combine ingredients
  ingredientsList.forEach(item => {
    try {
      if (!item) return;

      // Convert to string if it's not already
      const itemStr = typeof item === 'string' ? item : String(item);
      let fullItemName = itemStr.trim().toLowerCase();
      if (!fullItemName) return;

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
      const normalizedItemName = fullItemName.replace(/s$/, '') || fullItemName;
      if (!normalizedItemName) return;

      // Combine total quantity for similar items
      if (!ingredientTotals[normalizedItemName]) {
        ingredientTotals[normalizedItemName] = {
          quantity: quantity,
          unit: unit
        };
      } else {
        ingredientTotals[normalizedItemName].quantity += quantity;
      }
    } catch (itemError) {
      console.error("Error processing ingredient item:", itemError, item);
    }
  });

  // Categorize normalized items
  Object.entries(ingredientTotals).forEach(([itemName, details]) => {
    try {
      // Determine category based on keywords
      let category = 'Other';

      // Safely iterate through category mappings
      for (const cat in CATEGORY_MAPPING) {
        if (CATEGORY_MAPPING[cat]) {
          const keywords = CATEGORY_MAPPING[cat];
          for (const keyword of keywords) {
            if (itemName.toLowerCase().includes(keyword.toLowerCase())) {
              category = cat;
              break;
            }
          }
          if (category !== 'Other') break;
        }
      }

      // Create category array if it doesn't exist
      if (!categorizedItems[category]) {
        categorizedItems[category] = [];
      }

      // Improved formatting logic with added safety
      let formattedItem;
      try {
        if (details.quantity > 1) {
          formattedItem = `${details.quantity} ${details.unit ? details.unit + 's' : ''} ${itemName}`.trim();
        } else if (details.unit) {
          formattedItem = `${details.unit} ${itemName}`.trim();
        } else {
          formattedItem = `${details.quantity} ${itemName}`.trim();
        }
      } catch (formatError) {
        console.error("Error formatting item:", formatError);
        formattedItem = itemName; // Use just the name as fallback
      }

      categorizedItems[category].push(formattedItem);
    } catch (categoryError) {
      console.error("Error categorizing item:", categoryError, itemName);
    }
  });

  // If we somehow ended up with no categories, create a default
  if (Object.keys(categorizedItems).length === 0) {
    console.warn("No categories were created, using default category");
    categorizedItems['Other'] = ingredientsList.filter(item => item !== null && item !== undefined)
                                       .map(item => typeof item === 'string' ? item : String(item));
  }

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

      showSnackbar(`Items added to ${selectedStore} cart`);
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
      showSnackbar(`Error: ${err.message}`);
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
            
            showSnackbar(`Items added to Kroger cart`);
          } catch (cartErr) {
            console.error("Error adding items to Kroger cart:", cartErr);
            showSnackbar(`Error adding items to Kroger cart: ${cartErr.message}`);
          }
          
          setPendingAllItems(false);
        }
      } else {
        setError(result.message || "Failed to set store location");
        showSnackbar(`Error: ${result.message}`);
      }
    } catch (err) {
      console.error("Error setting store location:", err);
      setError(err.message || "An error occurred setting the store location");
      showSnackbar(`Error: ${err.message}`);
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
                  onClick={() => {
                    // Set loading state immediately for a more responsive feel
                    console.log("SIMPLE EMERGENCY FIX: Regenerate AI List button clicked");
                    setAiShoppingLoading(true);
                    // Switch to AI tab
                    setActiveTab(1);
                    // Reset loading message index to start fresh
                    setLoadingMessageIndex(0);

                    // EMERGENCY DIRECT FIX - Using simplest possible approach
                    console.log("SIMPLE EMERGENCY FIX: Getting shopping list with menuId:", selectedMenuId);

                    const emergencyFetchList = async () => {
                      try {
                        // Get the token
                        const token = localStorage.getItem('token');

                        // Direct API call with minimal processing
                        const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${selectedMenuId}/grocery-list`, {
                          method: 'GET',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });

                        // Basic error handling
                        if (!response.ok) {
                          throw new Error(`API error: ${response.status}`);
                        }

                        // Parse the response
                        const result = await response.json();
                        console.log("SIMPLE EMERGENCY FIX: Got shopping list:", result);

                        // Very basic item extraction - get anything we can find
                        let items = [];
                        if (result.ingredient_list && Array.isArray(result.ingredient_list)) {
                          items = result.ingredient_list;
                        } else if (result.items && Array.isArray(result.items)) {
                          items = result.items;
                        } else if (Array.isArray(result)) {
                          items = result;
                        } else {
                          // Last attempt - get any array from the response
                          for (const key in result) {
                            if (Array.isArray(result[key]) && result[key].length > 0) {
                              items = result[key];
                              break;
                            }
                          }
                        }

                        // Create very simple categories
                        const categories = {
                          "Produce": [],
                          "Protein": [],
                          "Dairy": [],
                          "Grains": [],
                          "Other": []
                        };

                        // Process each item minimally
                        items.forEach(item => {
                          // Get the item as a string
                          const itemStr = typeof item === 'string' ? item :
                                        (item && item.name ? item.name : String(item));

                          // Very basic categorization
                          const lowerItem = itemStr.toLowerCase();
                          if (lowerItem.includes('chicken') || lowerItem.includes('beef') ||
                              lowerItem.includes('meat') || lowerItem.includes('fish')) {
                            categories["Protein"].push(itemStr);
                          } else if (lowerItem.includes('milk') || lowerItem.includes('cheese') ||
                                    lowerItem.includes('egg') || lowerItem.includes('yogurt')) {
                            categories["Dairy"].push(itemStr);
                          } else if (lowerItem.includes('apple') || lowerItem.includes('banana') ||
                                    lowerItem.includes('vegetable') || lowerItem.includes('tomato') ||
                                    lowerItem.includes('lettuce') || lowerItem.includes('onion')) {
                            categories["Produce"].push(itemStr);
                          } else if (lowerItem.includes('bread') || lowerItem.includes('rice') ||
                                    lowerItem.includes('pasta') || lowerItem.includes('cereal')) {
                            categories["Grains"].push(itemStr);
                          } else {
                            categories["Other"].push(itemStr);
                          }
                        });

                        // Format for the UI
                        const formattedCategories = Object.entries(categories)
                          .filter(([_, items]) => items.length > 0)
                          .map(([category, items]) => ({
                            category,
                            items: items.map(item => ({
                              name: item,
                              display_name: item
                            }))
                          }));

                        // If we got nothing, create a single category with all items
                        if (formattedCategories.length === 0 && items.length > 0) {
                          formattedCategories.push({
                            category: "All Items",
                            items: items.map(item => ({
                              name: typeof item === 'string' ? item : (item.name || String(item)),
                              display_name: typeof item === 'string' ? item : (item.name || String(item))
                            }))
                          });
                        }

                        // Update state with our simple data
                        setAiShoppingLoading(false);
                        setAiShoppingData({
                          groceryList: formattedCategories,
                          menuId: selectedMenuId,
                          status: "completed",
                          cached: true,
                          nutritionTips: [
                            "Try to prioritize whole foods over processed options.",
                            "Choose lean proteins for healthier meal options."
                          ],
                          recommendations: [
                            "Shop the perimeter of the store first for fresh foods.",
                            "Check your pantry before shopping to avoid duplicates."
                          ]
                        });
                        setActiveTab(1);
                        setUsingAiList(true);

                      } catch (error) {
                        console.error("SIMPLE EMERGENCY FIX: Error:", error);
                        setAiShoppingLoading(false);

                        // Even if we fail, provide some data to show something
                        setAiShoppingData({
                          groceryList: [{
                            category: "All Items",
                            items: [{ name: "Error fetching items", display_name: "Please try again" }]
                          }],
                          menuId: selectedMenuId,
                          status: "error",
                          cached: false,
                          nutritionTips: ["Error fetching shopping list."],
                          recommendations: ["Please try refreshing the page."]
                        });
                      }
                    };

                    // Run our emergency fix
                    emergencyFetchList();
                  }} // Force refresh
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
                {activeTab === 1 && (
                  <Box>
                    {/* Processing indicator with entertaining messages */}
                    {aiShoppingLoading && (
                      <Card sx={{ mb: 3, backgroundColor: '#f8f9fa' }}>
                        <CardContent>
                          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={3}>
                            <CircularProgress size={60} sx={{ mb: 3 }} />
                            <Typography variant="h6" textAlign="center" gutterBottom>
                              AI Shopping List in Progress
                            </Typography>
                            <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ fontStyle: 'italic', mt: 1 }}>
                              {loadingMessages[loadingMessageIndex]}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
                              This may take up to 60 seconds. We're creating a smart, categorized shopping list for you.
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {/* No AI shopping data yet, but we can show the generate button */}
                    {!aiShoppingData && !aiShoppingLoading && (
                      <Box sx={{ my: 3, p: 3, border: '1px dashed #e0e0e0', borderRadius: 2, bgcolor: '#fafafa', textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>
                          AI Shopping List
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                          Get a smart, categorized shopping list with healthy alternatives and shopping tips.
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<AutoAwesome />}
                          onClick={generateNewAiList}
                          disabled={!selectedMenuId}
                          size="large"
                          sx={{ mt: 2 }}
                        >
                          Generate AI List
                        </Button>

                        {generationStats && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Chip
                              icon={generationStats.success ? <TipsIcon /> : <OfferIcon />}
                              label={generationStats.success ?
                                `Generated in ${generationStats.duration.toFixed(1)}s` :
                                'Failed to generate'}
                              color={generationStats.success ? "success" : "error"}
                              variant="outlined"
                              size="small"
                            />
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Display AI shopping data when available */}
                    {aiShoppingData && (
                    <>
                    {/* Display cache info if applicable */}
                    {aiShoppingData.cached && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Using cached shopping list from {new Date(aiShoppingData.cache_time).toLocaleString()}.
                        <Button
                          size="small"
                          sx={{ ml: 2 }}
                          onClick={() => {
                            setAiShoppingLoading(true);
                            setActiveTab(1);
                            setLoadingMessageIndex(0);

                            // TRY THE SIMPLEST APPROACH - just fetch the current shopping list
                            directFetchShoppingList(selectedMenuId);
                          }}
                        >
                          Refresh
                        </Button>
                      </Alert>
                    )}

                    {/* New AI List Generation Button */}
                    <Box sx={{ my: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#f9f9f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={aiShoppingLoading ? <CircularProgress size={20} /> : <AutoAwesome />}
                          onClick={generateNewAiList}
                          disabled={aiShoppingLoading || !selectedMenuId}
                        >
                          New AI List
                        </Button>

                        {generationStats && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip
                              icon={generationStats.success ? <TipsIcon /> : <OfferIcon />}
                              label={generationStats.success ?
                                `Generated in ${generationStats.duration.toFixed(1)}s` :
                                'Failed to generate'}
                              color={generationStats.success ? "success" : "error"}
                              variant="outlined"
                              size="small"
                            />
                          </Box>
                        )}
                      </Box>

                      {/* Logs Display */}
                      <Accordion
                        expanded={showLogs}
                        onChange={() => setShowLogs(!showLogs)}
                        sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}
                      >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="subtitle2">
                            Generation Logs {generationLogs.length > 0 ? `(${generationLogs.length})` : ''}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {generationLogs.length > 0 ? (
                            <List dense sx={{ maxHeight: '200px', overflow: 'auto' }}>
                              {generationLogs.map((log, index) => (
                                <ListItem key={index} sx={{
                                  py: 0.5,
                                  color: log.type === 'error' ? 'error.main' :
                                         log.type === 'success' ? 'success.main' :
                                         log.type === 'warning' ? 'warning.main' : 'text.primary'
                                }}>
                                  <ListItemText
                                    primary={`${log.timestamp}: ${log.message}`}
                                    primaryTypographyProps={{ fontSize: '0.85rem' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No generation logs available.
                            </Typography>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    </Box>

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
                                        {typeof item === 'string' ? item : (
                                          // Handle cheese special case with 1g quantity
                                          ((item.name && (item.name.toLowerCase().includes('cheese') ||
                                                         item.name.toLowerCase().includes('mozzarella'))) &&
                                          item.quantity === '1' && item.unit === 'g') ? (
                                            // Apply proper cheese quantities based on type
                                            item.name.toLowerCase().includes('cheddar') ||
                                            item.name.toLowerCase().includes('mozzarella') ?
                                              `${item.name}: 8 oz` :
                                            item.name.toLowerCase().includes('feta') ||
                                            item.name.toLowerCase().includes('parmesan') ?
                                              `${item.name}: 1/4 cup` :
                                              `${item.name}: 4 oz`
                                          ) : (
                                            // Otherwise use display_name if available
                                            item.display_name ? item.display_name :
                                            // Or build a string with name, quantity and unit
                                            `${item.name || 'Unknown item'}${item.quantity ? ': ' + item.quantity : ''}${item.unit ? ' ' + item.unit : ''}`
                                          )
                                        )}
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
                    </>
                    )}
                  </Box>
                )}
              </div>
            </>
          ) : (
            // No AI data, just show regular shopping list
            {aiData && aiData.categories ? (
              <SmartShoppingList
                groceryData={aiData}
                selectedStore={selectedStore}
                onAddToCart={handleAddToCart}
              />
            ) : (
              <ShoppingList
                categories={formatCategoriesForDisplay(groceryList)}
                selectedStore={selectedStore}
                onAddToCart={handleAddToCart}
                onAddToMixedCart={handleAddToMixedCart}
              />
            )}
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
            startIcon={<AiIcon />}
            color="primary"
          >
            Use AI (Cached)
          </Button>
          <Button
            onClick={() => {
              setShowAiShoppingPrompt(false);
              setActiveTab(1);
              generateNewAiList();
            }}
            variant="contained"
            startIcon={<AutoAwesome />}
            color="secondary"
          >
            New AI List
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