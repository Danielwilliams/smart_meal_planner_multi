// src/components/ShoppingListSimplified.jsx
// A simplified version focused on fixing the quantity display issue

import React from 'react';
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

// Simplified ShoppingListItem component that handles different data formats
const ShoppingListItem = ({ item, selectedStore, onAddToCart, onAddToMixedCart, onKrogerNeededSetup }) => {
  console.log('SIMPLIFIED ShoppingListItem received:', typeof item, item);

  // Parse and format the item data for display
  let processedItem = {
    name: '',
    displayText: '',
    rawItem: item
  };

  // Handle different item formats
  if (typeof item === 'string') {
    // Simple string format
    processedItem.name = item;
    processedItem.displayText = item;
  } 
  else if (item && typeof item === 'object') {
    // Object with name/quantity properties
    if (item.name) {
      // Store original name for cart operations
      processedItem.name = item.name;
      
      // First, check if it has a display_name already
      if (item.display_name) {
        processedItem.displayText = item.display_name;
      }
      // Next, check if it has actual_quantity from previous processing
      else if (item.actual_quantity) {
        processedItem.displayText = `${item.name}: ${item.actual_quantity}`;
      }
      // Check for embedded quantity pattern: "96 ozs chicken breast"
      else {
        const nameStr = item.name;
        const qtyRegex = /^([\d\.\/]+\s*(?:ozs?|pieces?|cups?|tbsps?|tsps?|cloves?|pinch|can|inch|lb|lbs|g|kg))\s+(.+)$/i;
        const match = nameStr.match(qtyRegex);
        
        if (match) {
          // Found embedded quantity in name
          const extractedQty = match[1];
          const cleanName = match[2];
          
          // Capitalize first letter of each word in name
          const formattedName = cleanName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          processedItem.name = formattedName;
          processedItem.displayText = `${formattedName}: ${extractedQty}`;
          console.log('FIXED: Extracted quantity from name:', processedItem.displayText);
        }
        // Check for standard quantity field
        else if (item.quantity && item.quantity !== '1') {
          processedItem.displayText = `${item.name}: ${item.quantity}${item.unit ? ' ' + item.unit : ''}`;
        }
        // Default to just the name
        else {
          processedItem.displayText = item.name;
        }
      }
    } else {
      // Object without name property - use toString
      processedItem.name = "Unknown item";
      processedItem.displayText = "Unknown item";
    }
  } else {
    // Fallback for any other type
    processedItem.name = "Unknown item";
    processedItem.displayText = "Unknown item";
  }

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
      <Typography>
        {/* Display the processed item text */}
        {processedItem.displayText}
      </Typography>

      {selectedStore === 'mixed' ? (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            sx={{ mr: 1 }}
            onClick={() => handleStoreClick('walmart', processedItem.name)}
          >
            Add to Walmart
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleStoreClick('kroger', processedItem.name)}
          >
            Add to Kroger
          </Button>
        </Box>
      ) : (
        <Button
          variant="outlined"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => handleStoreClick(selectedStore, processedItem.name)}
        >
          Add to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
        </Button>
      )}
    </Grid>
  );
};

// Simplified ShoppingList component that handles different data formats
const ShoppingListSimplified = ({
  categories,
  selectedStore,
  onAddToCart,
  onAddToMixedCart
}) => {
  // State for store selector dialog
  const [showStoreSelector, setShowStoreSelector] = React.useState(false);
  const [pendingItem, setPendingItem] = React.useState(null);
  const [error, setError] = React.useState('');

  console.log('SIMPLIFIED ShoppingList received categories:', categories);
  
  // Handle Kroger setup dialog
  const handleKrogerNeededSetup = (item) => {
    setPendingItem(item);
    setShowStoreSelector(true);
  };
  
  const handleCloseStoreSelector = () => {
    setShowStoreSelector(false);
    setPendingItem(null);
  };
  
  // Handler to categorize and display flat array of items
  const renderFlatItemsList = (items) => {
    if (!Array.isArray(items)) return null;
    
    console.log('Rendering flat items list:', items);
    
    // Basic categorization
    const categorized = {
      'Protein': [],
      'Produce': [],
      'Dairy': [],
      'Grains': [],
      'Pantry': [],
      'Other': []
    };
    
    // Categorize items
    items.forEach(item => {
      if (!item) return;
      
      const nameText = typeof item === 'object' ? 
                    (item.name || '').toLowerCase() : 
                    (typeof item === 'string' ? item.toLowerCase() : '');
      
      let category = 'Other';
      
      // Basic categorization logic
      if (nameText.includes('chicken') || nameText.includes('beef') ||
          nameText.includes('meat') || nameText.includes('turkey') ||
          nameText.includes('fish')) {
        category = 'Protein';
      } else if (nameText.includes('vegetable') || nameText.includes('lettuce') ||
                nameText.includes('tomato') || nameText.includes('carrot') ||
                nameText.includes('onion') || nameText.includes('garlic') ||
                nameText.includes('pepper')) {
        category = 'Produce';
      } else if (nameText.includes('cheese') || nameText.includes('milk') ||
                nameText.includes('egg') || nameText.includes('yogurt')) {
        category = 'Dairy';
      } else if (nameText.includes('rice') || nameText.includes('pasta') ||
                nameText.includes('bread') || nameText.includes('tortilla') ||
                nameText.includes('quinoa')) {
        category = 'Grains';
      } else if (nameText.includes('oil') || nameText.includes('sauce') ||
                nameText.includes('spice') || nameText.includes('salt') ||
                nameText.includes('sugar') || nameText.includes('flour')) {
        category = 'Pantry';
      }
      
      categorized[category].push(item);
    });
    
    // Render each category that has items
    return (
      <>
        {Object.entries(categorized).map(([category, categoryItems]) => {
          if (categoryItems.length === 0) return null;
          
          return (
            <Paper key={category} elevation={3} sx={{ my: 2, p: 2 }}>
              <Typography variant="h6">{category}</Typography>
              <Grid container spacing={2}>
                {categoryItems.map((item, index) => (
                  <ShoppingListItem
                    key={`${category}-${index}`}
                    item={item}
                    selectedStore={selectedStore}
                    onAddToCart={onAddToCart || (() => {})}
                    onAddToMixedCart={onAddToMixedCart || (() => {})}
                    onKrogerNeededSetup={handleKrogerNeededSetup}
                  />
                ))}
              </Grid>
            </Paper>
          );
        })}
      </>
    );
  };

  // Handle different categories structures
  const renderContent = () => {
    // Case 1: categories is an array (flat format)
    if (Array.isArray(categories)) {
      return renderFlatItemsList(categories);
    }
    
    // Case 2: categories is an object with category keys
    else if (typeof categories === 'object' && categories !== null) {
      return (
        <>
          {Object.entries(categories).map(([category, items]) => {
            // Skip empty categories
            if (!items || !Array.isArray(items) || items.length === 0) return null;
            
            return (
              <Paper key={category} elevation={3} sx={{ my: 2, p: 2 }}>
                <Typography variant="h6">{category}</Typography>
                <Grid container spacing={2}>
                  {items.map((item, index) => (
                    <ShoppingListItem
                      key={`${category}-${index}`}
                      item={item}
                      selectedStore={selectedStore}
                      onAddToCart={onAddToCart || (() => {})}
                      onAddToMixedCart={onAddToMixedCart || (() => {})}
                      onKrogerNeededSetup={handleKrogerNeededSetup}
                    />
                  ))}
                </Grid>
              </Paper>
            );
          })}
        </>
      );
    }
    
    // Case 3: Empty or invalid data
    return (
      <Paper elevation={3} sx={{ my: 2, p: 2 }}>
        <Typography variant="h6">No items found</Typography>
        <Typography>No shopping list items are available.</Typography>
      </Paper>
    );
  };

  return (
    <>
      {renderContent()}
      
      {/* Kroger Store Selection Dialog */}
      <StoreSelector
        open={showStoreSelector}
        onClose={handleCloseStoreSelector}
        onStoreSelect={() => {}}
        storeType="kroger"
      />
      
      {/* Error Dialog */}
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

export default ShoppingListSimplified;