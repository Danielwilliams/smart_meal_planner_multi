import React, { useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  ShoppingCart as CartIcon
} from '@mui/icons-material';

/**
 * Simple categorized shopping list component that displays items grouped by category
 */
const CategorizedShoppingList = ({ groceryData, selectedStore, onAddToCart }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Handle accordion toggle
  const handleCategoryToggle = (category) => (event, isExpanded) => {
    setExpandedCategory(isExpanded ? category : null);
  };

  // Group items by category
  // Helper to format an item string nicely
  const formatItemDisplay = (item) => {
    if (typeof item === 'string') return item;

    const name = item.name || '';
    const quantity = item.quantity || '';
    const unit = item.unitOfMeasure || item.unit || '';

    return `${name}: ${quantity} ${unit}`.trim();
  };

  const getItemsByCategory = () => {
    // Handle traditional format
    if (groceryData && groceryData.groceryList && Array.isArray(groceryData.groceryList)) {
      // Old format - with groceryList array of category objects
      const categorized = {};

      // Special handling for "All Items" category - redistribute into proper categories
      if (groceryData.groceryList.length === 1 &&
          groceryData.groceryList[0].category === 'All Items' &&
          Array.isArray(groceryData.groceryList[0].items)) {

        console.log("Found 'All Items' category - recategorizing items");

        // Categorize items based on name
        groceryData.groceryList[0].items.forEach(item => {
          if (!item || !item.name) return;

          const itemName = item.name.toLowerCase();
          let category = 'Other';

          // Determine category based on name
          if (/chicken|beef|pork|fish|seafood|meat|protein|turkey|steak|sausage|bacon/.test(itemName)) {
            category = 'Meat & Seafood';
          } else if (/spinach|lettuce|tomato|onion|potato|garlic|pepper|vegetable|carrot|cucumber|produce|fruit|apple|banana|avocado|ginger/.test(itemName)) {
            category = 'Produce';
          } else if (/milk|cheese|yogurt|cream|egg|butter|dairy/.test(itemName)) {
            category = 'Dairy & Eggs';
          } else if (/bread|roll|tortilla|bagel|bakery/.test(itemName)) {
            category = 'Bakery & Bread';
          } else if (/pasta|rice|quinoa|cereal|grain|flour/.test(itemName)) {
            category = 'Dry Goods & Pasta';
          } else if (/frozen|ice cream/.test(itemName)) {
            category = 'Frozen Foods';
          } else if (/oil|vinegar|sauce|dressing|condiment|ketchup|mustard/.test(itemName)) {
            category = 'Condiments & Spices';
          } else if (/salt|pepper|spice|herb|seasoning/.test(itemName)) {
            category = 'Condiments & Spices';
          } else if (/cookie|chip|candy|snack/.test(itemName)) {
            category = 'Snacks';
          } else if (/water|juice|soda|beverage|drink|coffee|tea/.test(itemName)) {
            category = 'Beverages';
          } else if (/sugar|baking powder|baking soda|vanilla|chocolate/.test(itemName)) {
            category = 'Baking';
          }

          // Add to category
          if (!categorized[category]) {
            categorized[category] = [];
          }

          categorized[category].push(formatItemDisplay(item));
        });

        return categorized;
      }

      // Normal handling for pre-categorized groceryList
      groceryData.groceryList.forEach(catItem => {
        const category = catItem.category || 'Other';
        if (!categorized[category]) {
          categorized[category] = [];
        }

        if (Array.isArray(catItem.items)) {
          catItem.items.forEach(item => {
            // When using nested category objects, preserve the full item object
            if (typeof item === 'object' && item.name) {
              if (!categorized[category]) {
                categorized[category] = [];
              }
              categorized[category].push(item);
            } else {
              // Legacy format - just format as string
              categorized[category].push(formatItemDisplay(item));
            }
          });
        }
      });
      return categorized;
    }
    // Handle new direct format with items array and categories
    else if (groceryData && groceryData.items && Array.isArray(groceryData.items)) {
      // New format - with direct items array containing category field
      const categorized = {};
      groceryData.items.forEach(item => {
        const category = item.category || 'Other';
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(formatItemDisplay(item));
      });
      return categorized;
    }
    // Handle ingredient_list format
    else if (groceryData && groceryData.ingredient_list && Array.isArray(groceryData.ingredient_list)) {
      const categorized = {};
      groceryData.ingredient_list.forEach(item => {
        const category = item.category || 'Other';
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(formatItemDisplay(item));
      });
      return categorized;
    }
    // Handle direct array format (from OpenAI response)
    else if (Array.isArray(groceryData)) {
      const categorized = {};

      // First check if we have proper categories
      let hasProperCategories = false;
      if (groceryData.length > 0 && groceryData[0].category) {
        // Get unique categories
        const uniqueCategories = [...new Set(groceryData.map(item => item.category))];
        // If we have more than one category or a single category that's not "All Items",
        // then we have proper categorization
        hasProperCategories = uniqueCategories.length > 1 ||
                             (uniqueCategories.length === 1 && uniqueCategories[0] !== 'All Items');
      }

      if (hasProperCategories) {
        console.log("Direct array has proper categories:",
          [...new Set(groceryData.map(item => item.category))].join(', '));
      } else {
        console.log("Direct array lacks proper categories, will apply client-side categorization");
      }

      // Process each item
      groceryData.forEach(item => {
        if (item && typeof item === 'object') {
          let category = item.category || 'Other';

          // Apply client-side categorization if we don't have proper categories
          if (!hasProperCategories) {
            const itemName = (item.name || '').toLowerCase();

            // Only recategorize if the category is missing or "All Items"
            if (!item.category || item.category === 'All Items') {
              // Determine category based on name
              if (/chicken|beef|pork|fish|seafood|meat|protein|turkey|steak|sausage|bacon/.test(itemName)) {
                category = 'Meat & Seafood';
              } else if (/spinach|lettuce|tomato|onion|potato|garlic|pepper|vegetable|carrot|cucumber|produce|fruit|apple|banana|avocado|ginger/.test(itemName)) {
                category = 'Produce';
              } else if (/milk|cheese|yogurt|cream|egg|butter|dairy/.test(itemName)) {
                category = 'Dairy & Eggs';
              } else if (/bread|roll|tortilla|bagel|bakery/.test(itemName)) {
                category = 'Bakery & Bread';
              } else if (/pasta|rice|quinoa|cereal|grain|flour/.test(itemName)) {
                category = 'Dry Goods & Pasta';
              } else if (/frozen|ice cream/.test(itemName)) {
                category = 'Frozen Foods';
              } else if (/oil|vinegar|sauce|dressing|condiment|ketchup|mustard/.test(itemName)) {
                category = 'Condiments & Spices';
              } else if (/salt|pepper|spice|herb|seasoning/.test(itemName)) {
                category = 'Condiments & Spices';
              } else if (/cookie|chip|candy|snack/.test(itemName)) {
                category = 'Snacks';
              } else if (/water|juice|soda|beverage|drink|coffee|tea/.test(itemName)) {
                category = 'Beverages';
              } else if (/sugar|baking powder|baking soda|vanilla|chocolate/.test(itemName)) {
                category = 'Baking';
              } else {
                category = 'Other';
              }
            }
          }

          if (!categorized[category]) {
            categorized[category] = [];
          }

          categorized[category].push(formatItemDisplay(item));
        }
      });

      return categorized;
    }

    // As a last resort, try to directly categorize items from the data
    if (groceryData && typeof groceryData === 'object') {
      console.log("Trying direct categorization of unknown format:", groceryData);
      const categorized = {};

      // Function to process raw items
      const processRawItems = (items) => {
        if (!Array.isArray(items)) return;

        items.forEach(item => {
          if (!item) return;

          // For object items
          if (typeof item === 'object') {
            const name = item.name || '';
            if (!name) return;

            const itemName = name.toLowerCase();
            let category = 'Other';

            // Determine category based on name - same logic as above
            if (/chicken|beef|pork|fish|seafood|meat|protein|turkey|steak|sausage|bacon/.test(itemName)) {
              category = 'Meat & Seafood';
            } else if (/spinach|lettuce|tomato|onion|potato|garlic|pepper|vegetable|carrot|cucumber|produce|fruit|apple|banana|avocado|ginger/.test(itemName)) {
              category = 'Produce';
            } else if (/milk|cheese|yogurt|cream|egg|butter|dairy/.test(itemName)) {
              category = 'Dairy & Eggs';
            } else if (/bread|roll|tortilla|bagel|bakery/.test(itemName)) {
              category = 'Bakery & Bread';
            } else if (/pasta|rice|quinoa|cereal|grain|flour/.test(itemName)) {
              category = 'Dry Goods & Pasta';
            } else if (/frozen|ice cream/.test(itemName)) {
              category = 'Frozen Foods';
            } else if (/oil|vinegar|sauce|dressing|condiment|ketchup|mustard/.test(itemName)) {
              category = 'Condiments & Spices';
            } else if (/salt|pepper|spice|herb|seasoning/.test(itemName)) {
              category = 'Condiments & Spices';
            } else if (/cookie|chip|candy|snack/.test(itemName)) {
              category = 'Snacks';
            } else if (/water|juice|soda|beverage|drink|coffee|tea/.test(itemName)) {
              category = 'Beverages';
            } else if (/sugar|baking powder|baking soda|vanilla|chocolate/.test(itemName)) {
              category = 'Baking';
            }

            // Add to category
            if (!categorized[category]) {
              categorized[category] = [];
            }

            categorized[category].push(formatItemDisplay(item));
          }
          // For string items
          else if (typeof item === 'string') {
            const itemName = item.toLowerCase();
            let category = 'Other';

            // Simple category determination
            if (/chicken|beef|pork|fish|meat/.test(itemName)) {
              category = 'Meat & Seafood';
            } else if (/vegetable|fruit|produce/.test(itemName)) {
              category = 'Produce';
            } else if (/dairy|milk|cheese|yogurt|egg/.test(itemName)) {
              category = 'Dairy & Eggs';
            }

            // Add to category
            if (!categorized[category]) {
              categorized[category] = [];
            }

            categorized[category].push(item);
          }
        });
      };

      // Try to find items in various places
      if (Array.isArray(groceryData)) {
        processRawItems(groceryData);
      } else {
        // Look for arrays in the object
        Object.values(groceryData).forEach(value => {
          if (Array.isArray(value)) {
            processRawItems(value);
          }
        });
      }

      // If we found any categories, return them
      if (Object.keys(categorized).length > 0) {
        console.log("Successfully categorized raw items into:", Object.keys(categorized));
        return categorized;
      }
    }

    return {}; // Default empty object if no recognized format
  };

  // Get color for category
  const getCategoryColor = (category) => {
    const colors = {
      // Original colors
      'Protein': '#F44336', // Red
      'Produce': '#4CAF50', // Green
      'Dairy': '#2196F3',   // Blue
      'Grains': '#FF9800',  // Orange
      'Pantry': '#795548',  // Brown
      'Condiments': '#9C27B0', // Purple

      // New standard categories
      'Meat & Seafood': '#F44336', // Red
      'Dairy & Eggs': '#2196F3',   // Blue
      'Bakery & Bread': '#FF9800', // Orange
      'Dry Goods & Pasta': '#FF9800', // Orange
      'Canned Goods': '#795548', // Brown
      'Frozen Foods': '#00BCD4', // Cyan
      'Condiments & Spices': '#9C27B0', // Purple
      'Snacks': '#FF4081', // Pink
      'Beverages': '#3F51B5', // Indigo
      'Baking': '#795548', // Brown

      'Other': '#9E9E9E'    // Grey
    };
    return colors[category] || colors['Other'];
  };

  // Get items grouped by category
  const categorizedItems = getItemsByCategory();
  const categories = Object.keys(categorizedItems);

  // Auto-expand first category if none is expanded
  if (categories.length > 0 && expandedCategory === null) {
    setExpandedCategory(categories[0]);
  }

  return (
    <Paper elevation={3} sx={{ p: 2, my: 2 }}>
      <Typography variant="h5" gutterBottom>
        <CartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Shopping List
      </Typography>

      {categories.length === 0 ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">No items in shopping list</Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          {/* Recommendations and tips */}
          {groceryData.recommendations && groceryData.recommendations.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Shopping Recommendations:
              </Typography>
              <List dense>
                {groceryData.recommendations.map((tip, index) => (
                  <ListItem key={`rec-${index}`}>
                    <ListItemText primary={`• ${tip}`} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Categorized items */}
          {categories.map((category) => (
            <Accordion 
              key={category}
              expanded={expandedCategory === category}
              onChange={handleCategoryToggle(category)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  borderLeft: `4px solid ${getCategoryColor(category)}`,
                  bgcolor: expandedCategory === category ? 'rgba(0, 0, 0, 0.03)' : 'transparent' 
                }}
              >
                <Typography variant="subtitle1">
                  {category} ({categorizedItems[category].length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense>
                  {categorizedItems[category].map((item, idx) => (
                    <React.Fragment key={`${category}-${idx}`}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        secondaryAction={
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            variant="outlined"
                            onClick={() => {
                              // Handle both string and object formats
                              const itemName = typeof item === 'string'
                                ? item.split(':')[0].trim()
                                : (item.name || '').trim();
                              onAddToCart && onAddToCart(itemName, selectedStore);
                            }}
                          >
                            Add
                          </Button>
                        }
                      >
                        {typeof item === 'object' && item.name ? (
                          <ListItemText
                            primary={`${item.name}: ${item.quantity || ''} ${item.unitOfMeasure || item.unit || ''}`}
                          />
                        ) : (
                          <ListItemText primary={item} />
                        )}
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      <Box display="flex" justifyContent="center" mt={3}>
        <Chip 
          icon={<CartIcon />} 
          label={`Store: ${selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)}`}
          color="primary"
        />
      </Box>
    </Paper>
  );
};

export default CategorizedShoppingList;