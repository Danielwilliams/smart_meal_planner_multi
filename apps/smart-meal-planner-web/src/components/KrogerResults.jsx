// src/components/KrogerResults.jsx
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  Button, 
  Grid, 
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ImageIcon from '@mui/icons-material/Image';

const KrogerResults = ({ results, onAddToCart }) => {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showCartDialog, setShowCartDialog] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  
  // Track successful image URLs to optimize loading
  const [workingImagePattern, setWorkingImagePattern] = useState(null);

  const toggleItemSelection = (upc) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(upc)) {
        newSet.delete(upc);
      } else {
        newSet.add(upc);
      }
      return newSet;
    });
  };

  const handleAddSelectedToCart = async () => {
    const itemsToAdd = results.filter(item => selectedItems.has(item.upc));
    
    try {
      // Call the parent handler to add items to cart
      await onAddToCart(itemsToAdd);
      
      // Show the "Go to Kroger Cart" dialog
      setShowCartDialog(true);
      
      // Clear selections after adding to cart
      setSelectedItems(new Set());
    } catch (err) {
      console.error('Error adding items to cart:', err);
      // Keep selections if there's an error
    }
  };

  const handleCloseDialog = () => {
    setShowCartDialog(false);
  };

  const goToKrogerCart = () => {
    // Open Kroger cart in a new tab
    window.open('https://www.kroger.com/cart', '_blank');
    setShowCartDialog(false);
  };

  const handleImageError = (upc, pattern) => {
    // Only update errors for the specific pattern that failed
    setImageErrors(prev => ({
      ...prev,
      [`${upc}-${pattern}`]: true
    }));
  };

  const handleImageLoad = (pattern) => {
    if (!workingImagePattern) {
      setWorkingImagePattern(pattern);
      console.log(`Found working image pattern: ${pattern}`);
    }
  };

  // Get product image URL from item or try various Kroger CDN patterns
  const getProductImageUrl = (item) => {
    // First, check if the item already has an image property from our mock data
    if (item.image && item.image.startsWith('http')) {
      return {
        url: item.image,
        pattern: 'provided'
      };
    }
    
    const upc = item.upc;
    if (!upc) return null;

    // For Kroger, we need to make sure the UPC has leading zeros to be 13 characters
    const paddedUpc = upc.padStart(13, '0');
    
    // If we already found a working pattern, use it first
    if (workingImagePattern) {
      const url = generateImageUrl(paddedUpc, workingImagePattern);
      if (!imageErrors[`${paddedUpc}-${workingImagePattern}`]) {
        return {
          url,
          pattern: workingImagePattern
        };
      }
    }
    
    // Try all known patterns if no working pattern is established yet
    const patterns = [
      'kroger-medium-padded',
      'kroger-large-padded',
      'kroger-xlarge-padded',
      'kroger-medium',
      'kroger-large',
      'kroger-thumbnail',
      'kroger-cdn-1',
      'kroger-cdn-2',
      'fallback'
    ];
    
    // Find the first pattern that hasn't errored for this UPC
    for (const pattern of patterns) {
      if (!imageErrors[`${paddedUpc}-${pattern}`]) {
        return {
          url: generateImageUrl(paddedUpc, pattern),
          pattern
        };
      }
    }
    
    return null;
  };
  
  // Helper to generate URLs for different patterns
  const generateImageUrl = (upc, pattern) => {
    const cleanUpc = upc.replace(/^0+/, '');
    
    switch (pattern) {
      // Padded UPC patterns (keeping all zeros)
      case 'kroger-xlarge-padded':
        return `https://www.kroger.com/product/images/xlarge/front/${upc}`;
      case 'kroger-large-padded':
        return `https://www.kroger.com/product/images/large/front/${upc}`;
      case 'kroger-medium-padded':
        return `https://www.kroger.com/product/images/medium/front/${upc}`;
        
      // Legacy patterns with clean UPC
      case 'kroger-large':
        return `https://www.kroger.com/product/images/large/front/${cleanUpc}`;
      case 'kroger-medium':
        return `https://www.kroger.com/product/images/medium/front/${cleanUpc}`;
      case 'kroger-thumbnail':
        return `https://www.kroger.com/product/images/thumbnail/front/${cleanUpc}`;
      case 'kroger-cdn-1':
        return `https://www.kroger.com/product/images/xlarge/front/${cleanUpc}`;
      case 'kroger-cdn-2':
        return `https://assets.shop.kroger.com/products/${cleanUpc}/front/default/medium`;
      case 'fallback':
        // For some common product categories, use category-specific product images
        const categoryImages = {
          produce: "https://www.kroger.com/product/images/medium/front/0000000004011", // Banana
          dairy: "https://www.kroger.com/product/images/medium/front/0001111050314",   // Milk
          meat: "https://www.kroger.com/product/images/medium/front/0002100006000",    // Chicken
          bakery: "https://www.kroger.com/product/images/medium/front/0001111091100",  // Bread
          default: "https://www.kroger.com/product/images/medium/front/0003800031903"  // General
        };
        
        // Determine category based on UPC or return default
        return categoryImages.default;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Search Results
        </Typography>
        {selectedItems.size > 0 && (
          <Button
            variant="contained"
            startIcon={<AddShoppingCartIcon />}
            onClick={handleAddSelectedToCart}
          >
            Add {selectedItems.size} to Cart
          </Button>
        )}
      </Box>
      
      <Grid container spacing={2}>
        {results.map((item) => {
          const imageData = getProductImageUrl(item);
          
          return (
            <Grid item xs={12} sm={6} md={4} key={item.upc}>
              <Card 
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease-in-out',
                  border: selectedItems.has(item.upc) ? 2 : 1,
                  borderColor: selectedItems.has(item.upc) ? 'primary.main' : 'grey.300'
                }}
              >
                {imageData ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={imageData.url}
                    alt={item.name || item.description}
                    onError={() => handleImageError(item.upc, imageData.pattern)}
                    onLoad={() => handleImageLoad(imageData.pattern)}
                    sx={{
                      objectFit: 'contain',
                      bgcolor: '#f8f8f8',
                      p: 1
                    }}
                  />
                ) : (
                  <Box 
                    sx={{ 
                      height: 160, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      bgcolor: '#f8f8f8',
                      flexDirection: 'column'
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No image available
                    </Typography>
                  </Box>
                )}
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" component="div" sx={{ fontSize: '1rem' }}>
                        {item.name || item.description || 'Product'}
                      </Typography>
                      {item.brand && (
                        <Typography variant="body2" color="text.secondary">
                          {item.brand}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      color={selectedItems.has(item.upc) ? "primary" : "default"}
                      onClick={() => toggleItemSelection(item.upc)}
                      size="small"
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mt: 'auto',
                    pt: 1
                  }}>
                    <Typography variant="h6" color="primary">
                      ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price || '0.00'}
                    </Typography>
                    {item.size && (
                      <Typography variant="body2" color="text.secondary">
                        {item.size}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {results.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No products found matching your search.
          </Typography>
        </Box>
      )}

      {/* Dialog to confirm cart addition and provide link to Kroger cart */}
      <Dialog open={showCartDialog} onClose={handleCloseDialog}>
        <DialogTitle>Items Added to Kroger Cart</DialogTitle>
        <DialogContent>
          <Typography>
            Your items have been successfully added to your Kroger cart.
            Would you like to view your cart on Kroger's website?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Continue Shopping
          </Button>
          <Button 
            onClick={goToKrogerCart} 
            variant="contained" 
            color="primary"
            startIcon={<ShoppingCartIcon />}
          >
            Go to Kroger Cart
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KrogerResults;