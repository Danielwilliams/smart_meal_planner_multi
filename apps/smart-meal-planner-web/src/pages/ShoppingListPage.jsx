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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  ShoppingBasket as BasketIcon,
  Kitchen as KitchenIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import StoreSelector, { StoreTypeSelector } from '../components/StoreSelector';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import CATEGORY_MAPPING from '../data/categoryMapping';
import ShoppingList from '../components/ShoppingList';
import MealShoppingList from '../components/MealShoppingList';
import ErrorBoundary from '../components/ErrorBoundary';
import instacartService from '../services/instacartService';
import instacartBackendService from '../services/instacartBackendService';
import OnboardingWalkthrough from '../components/ImprovedOnboardingWalkthrough';

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

  // Tab management
  const [activeTab, setActiveTab] = useState(0); // 0 = Standard, 1 = By Meal

  // Instacart state
  const [instacartRetailerId, setInstacartRetailerId] = useState('');
  const [creatingShoppingList, setCreatingShoppingList] = useState(false);
  const [shoppingListUrl, setShoppingListUrl] = useState(null);
  const [showShoppingListDialog, setShowShoppingListDialog] = useState(false);

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
      let displayText, itemNameForCategorization;

      if (typeof item === 'string') {
        // Item is already a formatted string from backend (e.g., "Beef (ground): 1 lb")
        displayText = item.trim();

        // Extract just the name part for categorization (before the colon)
        if (item.includes(':')) {
          itemNameForCategorization = item.split(':')[0].trim();
        } else {
          itemNameForCategorization = item.trim();
        }
      } else if (item && typeof item === 'object') {
        // Item is an object with name and quantity properties
        const itemName = item.name || '';
        const itemQuantity = item.quantity || '';

        if (itemQuantity && itemName) {
          displayText = `${itemName}: ${itemQuantity}`;
        } else {
          displayText = itemName;
        }

        itemNameForCategorization = itemName;
      } else {
        return; // Skip invalid items
      }

      if (!itemNameForCategorization) return;

      // Determine category based on keywords using the name for categorization
      const normalizedName = itemNameForCategorization.toLowerCase();

      // Special case for flank steak to ensure it goes to meat-seafood
      let category;
      if (normalizedName.includes('flank')) {
        category = 'meat-seafood';
      } else {
        category = Object.keys(CATEGORY_MAPPING).find(cat =>
          CATEGORY_MAPPING[cat].some(keyword =>
            normalizedName.includes(keyword.toLowerCase())
          )
        ) || 'Other';
      }

      // Debug: log categorization for problematic items
      if (normalizedName.includes('flank') || normalizedName.includes('steak')) {
        console.log('Categorizing steak/flank item:', {
          originalItem: item,
          itemNameForCategorization,
          normalizedName,
          foundCategory: category,
          allCategories: Object.keys(CATEGORY_MAPPING),
          meatSeafoodKeywords: CATEGORY_MAPPING['meat-seafood'],
          beveragesKeywords: CATEGORY_MAPPING['beverages'],
          matchedKeywords: Object.keys(CATEGORY_MAPPING).map(cat => ({
            category: cat,
            keywords: CATEGORY_MAPPING[cat].filter(keyword =>
              normalizedName.includes(keyword.toLowerCase())
            )
          })).filter(match => match.keywords.length > 0)
        });
      }

      // Create category array if it doesn't exist
      if (!categorized[category]) {
        categorized[category] = [];
      }

      // Add the item to its category
      categorized[category].push(displayText);
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

  // Initial data fetch
  useEffect(() => {
    fetchShoppingListData();
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

  // Instacart functionality
  const handleSelectInstacartRetailer = async () => {
    try {
      const retailers = await instacartService.getRetailers();
      if (retailers && retailers.length > 0) {
        // For now, select the first available retailer
        setInstacartRetailerId(retailers[0].id);
        setSnackbarMessage(`Selected retailer: ${retailers[0].name}`);
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error fetching retailers:', error);
      setSnackbarMessage('Error loading Instacart retailers');
      setSnackbarOpen(true);
    }
  };

  const handleCreateShoppingList = async (categories, selectedStore) => {
    if (selectedStore !== 'instacart') {
      setSnackbarMessage('Please select Instacart as your store to create shopping list');
      setSnackbarOpen(true);
      return;
    }

    try {
      setCreatingShoppingList(true);

      const result = await instacartBackendService.createShoppingListUrl(
        categories,
        instacartRetailerId
      );

      if (result && result.shoppingListUrl) {
        setShoppingListUrl(result.shoppingListUrl);
        setShowShoppingListDialog(true);
      } else {
        throw new Error('Failed to create shopping list URL');
      }
    } catch (error) {
      console.error('Error creating shopping list:', error);
      setSnackbarMessage('Error creating Instacart shopping list');
      setSnackbarOpen(true);
    } finally {
      setCreatingShoppingList(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom data-testid="shopping-list-title">
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
          <FormControl sx={{ flex: 1 }} data-testid="menu-selector">
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

        <StoreTypeSelector
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          instacartRetailerId={instacartRetailerId}
          onSelectInstacartRetailer={handleSelectInstacartRetailer}
          data-testid="store-selector"
        />

        {selectedStore !== 'mixed' && groceryList.length > 0 && (
          <Button
            variant="contained"
            onClick={handleStoreSearchAll}
            disabled={loading}
            data-testid="add-all-to-cart-button"
          >
            Add All to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
          </Button>
        )}
      </Box>

      {/* Shopping List Display with Tabs */}
      {groceryList && groceryList.length > 0 ? (
        <Box sx={{ width: '100%' }}>
          {/* Tab Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} data-testid="shopping-list-tabs">
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => {
                console.log(`Switching to tab: ${newValue}`);
                setActiveTab(newValue);
              }}
              aria-label="shopping list tabs"
              sx={{ mb: 2 }}
            >
              <Tab
                icon={<BasketIcon />}
                label="Standard"
                id="tab-0"
                aria-controls="tabpanel-0"
              />
              <Tab
                icon={<KitchenIcon />}
                label="By Meal"
                id="tab-1"
                aria-controls="tabpanel-1"
              />
            </Tabs>

            {/* Create Instacart Shopping List Button */}
            {selectedStore === 'instacart' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={creatingShoppingList ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
                onClick={() => handleCreateShoppingList(formatCategoriesForDisplay(groceryList), selectedStore)}
                disabled={creatingShoppingList}
                data-testid="create-instacart-list-button"
              >
                {creatingShoppingList ? 'Creating...' : 'Create Instacart List'}
              </Button>
            )}
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

          {/* By Meal List Tab Panel */}
          <div
            role="tabpanel"
            hidden={activeTab !== 1}
            id="tabpanel-1"
            aria-labelledby="tab-1"
          >
            {activeTab === 1 && (
              selectedMenuId ? (
                <ErrorBoundary
                  fallback={
                    <Alert severity="error" sx={{ my: 2 }}>
                      An error occurred loading meal lists. This feature may not be available yet.
                    </Alert>
                  }
                >
                  <MealShoppingList menuId={selectedMenuId} />
                </ErrorBoundary>
              ) : (
                <Alert severity="info">
                  Please select a menu to view meal-specific shopping lists.
                </Alert>
              )
            )}
          </div>
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

      {/* Kroger Store Selection Dialog */}
      <StoreSelector
        open={showKrogerStoreSelector}
        onClose={() => setShowKrogerStoreSelector(false)}
        onStoreSelect={handleKrogerStoreSelect}
        storeType="kroger"
      />

      {/* Instacart Shopping List Dialog */}
      <Dialog
        open={showShoppingListDialog}
        onClose={() => setShowShoppingListDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Instacart Shopping List Created
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your shopping list has been created successfully!
            Click the button below to open it in Instacart.
          </DialogContentText>
          {shoppingListUrl && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                href={shoppingListUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<ShoppingCartIcon />}
              >
                Open in Instacart
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexGrow: 1 }}
          >
            Powered by Instacart
          </Typography>
          <Button onClick={() => setShowShoppingListDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <OnboardingWalkthrough />
    </Container>
  );
}

export default ShoppingListPage;