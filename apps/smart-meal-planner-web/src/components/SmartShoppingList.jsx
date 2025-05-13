import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Grid,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  ShoppingCart as CartIcon,
  Store as StoreIcon
} from '@mui/icons-material';
import { processShoppingList, organizeByDepartment } from '../utils/smartShoppingListProcessor';

/**
 * SmartShoppingList - Enhanced shopping list with AI-like processing
 * Intelligently combines and formats grocery items
 */
const SmartShoppingList = ({ groceryData, selectedStore, onAddToCart }) => {
  const [processedList, setProcessedList] = useState([]);
  const [organizedList, setOrganizedList] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  // Process the grocery data when it changes
  useEffect(() => {
    setLoading(true);
    
    try {
      console.log("SmartShoppingList received data:", groceryData);
      
      // Extract flat list of items from grocery data
      let flatList = [];
      
      // Handle different data formats
      if (Array.isArray(groceryData)) {
        // Direct array of items
        flatList = groceryData;
      } else if (groceryData && typeof groceryData === 'object') {
        // Object with categories of items
        if (groceryData.days) {
          // Full menu structure with days
          flatList = extractItemsFromMenu(groceryData);
        } else if (groceryData.categories && typeof groceryData.categories === 'object') {
          // This is the shopping list format with categories
          console.log("Found categories structure:", groceryData.categories);
          // Flatten all items from all categories
          Object.entries(groceryData.categories).forEach(([category, items]) => {
            if (Array.isArray(items)) {
              flatList = [...flatList, ...items];
            }
          });
        } else {
          // Object with category keys - assume it's a direct categories object
          Object.values(groceryData).forEach(items => {
            if (Array.isArray(items)) {
              flatList = [...flatList, ...items];
            }
          });
        }
      }
      
      console.log("Extracted flat list:", flatList);
      
      // Process the items to combine and format quantities
      const processed = processShoppingList(flatList);
      setProcessedList(processed);
      
      // Organize by department
      const organized = organizeByDepartment(processed);
      setOrganizedList(organized);
      
      // Expand the first section by default
      if (Object.keys(organized).length > 0) {
        setExpandedSection(Object.keys(organized)[0]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error processing shopping list:", err);
      setError("Failed to process shopping list: " + err.message);
      setLoading(false);
    }
  }, [groceryData]);

  // Extract items from a menu structure
  const extractItemsFromMenu = (menu) => {
    const allItems = [];
    
    if (!menu.days || !Array.isArray(menu.days)) return allItems;
    
    menu.days.forEach(day => {
      // Process meals
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              if (typeof ing === 'object' && ing.name) {
                // Format: {name: "Ingredient", quantity: "2 cups"}
                const formattedItem = `${ing.name}: ${ing.quantity}`;
                allItems.push(formattedItem);
              } else if (typeof ing === 'string') {
                allItems.push(ing);
              }
            });
          }
        });
      }
      
      // Process snacks
      if (day.snacks && Array.isArray(day.snacks)) {
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            snack.ingredients.forEach(ing => {
              if (typeof ing === 'object' && ing.name) {
                // Format: {name: "Ingredient", quantity: "2 cups"}
                const formattedItem = `${ing.name}: ${ing.quantity}`;
                allItems.push(formattedItem);
              } else if (typeof ing === 'string') {
                allItems.push(ing);
              }
            });
          }
        });
      }
    });
    
    return allItems;
  };

  // Handle accordion section expand/collapse
  const handleAccordionChange = (section) => (event, isExpanded) => {
    setExpandedSection(isExpanded ? section : null);
  };
  
  // Handle adding an item to cart
  const handleAddToCart = (item) => {
    if (onAddToCart) {
      // Extract just the item name without quantity
      const itemName = item.includes(':') ? item.split(':')[0].trim() : item;
      onAddToCart(itemName, selectedStore);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ my: 3, p: 2 }}>
      <Typography variant="h5" gutterBottom>
        <CartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Smart Shopping List
      </Typography>
      
      <Typography variant="subtitle2" color="text.secondary" paragraph>
        Intelligently organized by department
      </Typography>
      
      {Object.keys(organizedList).length === 0 ? (
        <Alert severity="info" sx={{ my: 2 }}>
          No items found in your shopping list.
        </Alert>
      ) : (
        Object.entries(organizedList).map(([department, items]) => (
          <Accordion 
            key={department}
            expanded={expandedSection === department}
            onChange={handleAccordionChange(department)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${department}-content`}
              id={`${department}-header`}
              sx={{ 
                bgcolor: expandedSection === department ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
                borderLeft: '4px solid',
                borderColor: getDepartmentColor(department)
              }}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                {department} ({items.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense>
                {items.map((item, index) => (
                  <React.Fragment key={`${department}-item-${index}`}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem
                      secondaryAction={
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          variant="outlined"
                          onClick={() => handleAddToCart(item)}
                        >
                          Add
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={<Typography variant="body1">{item}</Typography>}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))
      )}
      
      <Box display="flex" justifyContent="center" mt={3}>
        <Chip 
          icon={<StoreIcon />} 
          label={`Store: ${selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)}`}
          color="primary"
        />
      </Box>
    </Paper>
  );
};

// Helper to get color for department
function getDepartmentColor(department) {
  const colors = {
    'Produce': '#4CAF50',
    'Meat & Seafood': '#F44336',
    'Dairy & Eggs': '#2196F3',
    'Bakery': '#FF9800',
    'Pantry': '#795548',
    'Frozen': '#00BCD4',
    'Other': '#9E9E9E'
  };
  
  return colors[department] || colors['Other'];
}

export default SmartShoppingList;