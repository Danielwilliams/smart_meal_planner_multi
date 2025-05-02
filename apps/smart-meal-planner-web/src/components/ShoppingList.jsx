// src/components/ShoppingList.jsx

import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Grid,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import StoreSelector from './StoreSelector';
import apiService from '../services/apiService';

// Simple ShoppingList component that displays categorized items
// and allows adding them to cart
const ShoppingList = ({ 
  categories, 
  selectedStore,
  onAddToCart,
  onAddToMixedCart
}) => {
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [error, setError] = useState('');
  const [processedList, setProcessedList] = useState({});
  
  // Check if we have a configured Kroger store already
  useEffect(() => {
    // Check if we need to refresh the Kroger location from a temp storage
    const tempLocationId = localStorage.getItem('temp_kroger_location_id');
    const savedLocationId = localStorage.getItem('kroger_store_location_id');
    
    if (tempLocationId && (!savedLocationId || tempLocationId !== savedLocationId)) {
      console.log("Found temp Kroger location ID, attempting to save permanently");
      const refreshLocation = async () => {
        try {
          await apiService.updateKrogerLocation(tempLocationId);
          localStorage.removeItem('temp_kroger_location_id');
        } catch (err) {
          console.error("Failed to save temp location:", err);
        }
      };
      refreshLocation();
    }
  }, []);

  // Process the ingredients list when categories change
  useEffect(() => {
    if (categories) {
      // First, send the raw list to the backend for processing
      processShoppingList();
    }
  }, [categories]);

  // Process the shopping list using the backend
  const processShoppingList = async () => {
    try {
      // Simple client-side processing
      // In a real implementation, this could be sent to the backend
      const processedCategories = {};
      
      for (const [category, items] of Object.entries(categories)) {
        // Basic processing for display - normally would be more sophisticated
        const processedItems = items
          .filter(item => item && typeof item === 'string' && item.trim())
          .map(item => {
            // Extract product codes and quantities if present
            if (/^\d{3,4}\s+/.test(item)) {
              const [prefix, ...rest] = item.split(' ');
              const remainder = rest.join(' ');
              
              // Handle common formats
              if (remainder.includes('chicken breast')) {
                return `Chicken Breast: ${prefix}g`;
              } 
              else if (remainder.includes('beef') && remainder.includes('strip')) {
                return `Beef Strips: ${prefix}g`;
              }
              else if (remainder.includes('chicken thigh')) {
                return `Chicken Thighs: ${prefix}g`;
              }
              else if (remainder.includes('broccoli')) {
                return `Broccoli: ${prefix}g`;
              }
              else if (remainder.includes('bell pepper')) {
                return `Bell Peppers: ${prefix}g`;
              }
              else if (remainder.includes('tomato') && !remainder.includes('cherry')) {
                return `Tomatoes: ${prefix}g`;
              }
              else if (remainder.includes('carrot')) {
                return `Carrots: ${prefix}g`;
              }
              else if (remainder.includes('potato')) {
                return `Potatoes: ${prefix}g`;
              }
              else if (remainder.includes('rice')) {
                return `Rice: ${prefix}g`;
              }
              else if (remainder.includes('mozzarella')) {
                return `Mozzarella: ${prefix} oz`;
              }
              else {
                // For unknown items, just use the remainder with quantity
                const displayName = remainder.charAt(0).toUpperCase() + remainder.slice(1);
                return `${displayName}: ${prefix}g`;
              }
            }
            // Handle simple number format (e.g., "4 eggs")
            else if (/^\d+\s+/.test(item)) {
              const [number, ...rest] = item.split(' ');
              const itemName = rest.join(' ');
              
              // Special cases for common items
              if (itemName.includes('egg')) {
                return `Eggs: ${number}`;
              }
              else if (itemName.includes('avocado')) {
                return `Avocados: ${number}`;
              }
              else if (itemName.includes('black bean')) {
                return `Black Beans: ${number} cups`;
              }
              else if (itemName.includes('bacon strip')) {
                return `Bacon Strips: ${number}`;
              }
              else if (itemName.includes('lettuce leaf')) {
                return `Lettuce Leaves: ${number}`;
              }
              else if (itemName.includes('quinoa')) {
                return `Quinoa: ${number} cups`;
              }
              else if (itemName.includes('garlic')) {
                return `Garlic: ${number} cloves`;
              }
              else if (itemName.includes('mixed green')) {
                return `Mixed Greens: ${number} cups`;
              }
              else {
                // Basic capitalization for other items
                const displayName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
                return `${displayName}: ${number}`;
              }
            }
            // Handle items without quantities
            else {
              // Special cases for common items
              if (item.includes('feta cheese')) {
                return 'Feta Cheese: 1/2 cup';
              }
              else if (item.includes('soy ginger dressing')) {
                return 'Soy Ginger Dressing: 1/4 cup';
              }
              else if (item.includes('kalamata olive')) {
                return 'Kalamata Olives: 1/4 cup';
              }
              else if (item.includes('saffron')) {
                return 'Saffron: 1/2 tsp';
              }
              else if (item.includes('cooking oil')) {
                return 'Cooking Oil: 2 tbsp';
              }
              else if (item.includes('cucumber')) {
                return 'Cucumber: 1';
              }
              else if (item.includes('salsa')) {
                return 'Salsa: 1 cup';
              }
              else {
                // Basic capitalization for other items
                return item.charAt(0).toUpperCase() + item.slice(1);
              }
            }
          });
        
        processedCategories[category] = processedItems;
      }
      
      setProcessedList(processedCategories);
    } catch (err) {
      console.error('Error processing shopping list:', err);
      setError('Failed to process shopping list');
    }
  };
  
  const handleKrogerNeededSetup = (item) => {
    setPendingItem(item);
    setShowStoreSelector(true);
  };
  
  const handleCloseStoreSelector = () => {
    setShowStoreSelector(false);
    setPendingItem(null);
  };
  
  const handleStoreSelect = async (locationId) => {
    if (!locationId) {
      setError("No store location selected");
      return;
    }
    
    try {
      console.log(`Selected Kroger store location: ${locationId}`);
      
      const result = await apiService.updateKrogerLocation(locationId);
      
      if (result.success) {
        // Store was successfully set
        console.log("Kroger store location set successfully");
        localStorage.setItem('kroger_store_configured', 'true');
        
        // Close the dialog
        setShowStoreSelector(false);
        
        // If we had a pending item, try to add it to the cart now
        if (pendingItem) {
          if (selectedStore === 'mixed') {
            onAddToMixedCart(pendingItem, 'kroger');
          } else {
            onAddToCart(pendingItem, 'kroger');
          }
          setPendingItem(null);
        }
      } else {
        setError(result.message || "Failed to set store location");
      }
    } catch (err) {
      console.error("Error setting store location:", err);
      setError(err.message || "An error occurred setting the store location");
    }
  };

  // Helper component for each individual shopping list item
  const ShoppingListItem = ({ 
    item, 
    selectedStore, 
    onAddToCart, 
    onAddToMixedCart,
    onKrogerNeededSetup
  }) => {
    const handleStoreClick = async (store, itemName) => {
      if (store === 'kroger') {
        try {
          // Check if we have a configured Kroger store in localStorage
          const isConfigured = localStorage.getItem('kroger_store_configured') === 'true';
          const locationId = localStorage.getItem('kroger_store_location_id');
          
          // If not configured, show the setup dialog
          if (!isConfigured || !locationId) {
            console.log("Kroger store not configured, showing setup dialog");
            onKrogerNeededSetup(itemName);
            return;
          }
          
          // If configured, try to add to cart
          if (selectedStore === 'mixed') {
            onAddToMixedCart(itemName, 'kroger');
          } else {
            onAddToCart(itemName, 'kroger');
          }
        } catch (err) {
          console.error("Error checking Kroger configuration:", err);
          onKrogerNeededSetup(itemName);
        }
      } else {
        // For Walmart, just proceed normally
        if (selectedStore === 'mixed') {
          onAddToMixedCart(itemName, store);
        } else {
          onAddToCart(itemName, store);
        }
      }
    };
    
    return (
      <Grid item xs={12} sm={6}>
        <Typography>{item}</Typography>
        
        {selectedStore === 'mixed' ? (
          <Box sx={{ mt: 1 }}>
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ mr: 1 }}
              onClick={() => handleStoreClick('walmart', item)}
            >
              Add to Walmart
            </Button>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => handleStoreClick('kroger', item)}
            >
              Add to Kroger
            </Button>
          </Box>
        ) : (
          <Button 
            variant="outlined" 
            size="small" 
            sx={{ mt: 1 }}
            onClick={() => handleStoreClick(selectedStore, item)}
          >
            Add to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
          </Button>
        )}
      </Grid>
    );
  };

  return (
    <>
      {Object.entries(processedList).map(([category, items]) => (
        <Paper key={category} elevation={3} sx={{ my: 2, p: 2 }}>
          <Typography variant="h6">{category}</Typography>
          <Grid container spacing={2}>
            {items.map((item, index) => (
              <ShoppingListItem 
                key={index}
                item={item}
                selectedStore={selectedStore}
                onAddToCart={onAddToCart}
                onAddToMixedCart={onAddToMixedCart}
                onKrogerNeededSetup={handleKrogerNeededSetup}
              />
            ))}
          </Grid>
        </Paper>
      ))}
      
      {/* Kroger Store Selection Dialog */}
      <StoreSelector 
        open={showStoreSelector}
        onClose={handleCloseStoreSelector}
        onStoreSelect={handleStoreSelect}
        storeType="kroger"
      />
      
      {error && (
        <Dialog open={!!error} onClose={() => setError('')}>
          <DialogTitle>Error</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setError('')} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default ShoppingList;