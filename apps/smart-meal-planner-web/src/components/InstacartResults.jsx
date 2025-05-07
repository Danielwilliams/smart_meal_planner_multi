// src/components/InstacartResults.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  InputAdornment,
  TextField,
  Alert,
  Snackbar
} from '@mui/material';
import { Add, Search, ShoppingBasket } from '@mui/icons-material';
import apiService from '../services/apiService';

const InstacartResults = ({ onAddToCart }) => {
  const [searchItems, setSearchItems] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSearch = async () => {
    if (!searchItems.trim()) {
      setError('Please enter search terms');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSearching(true);

      // Split search terms by commas or newlines
      const items = searchItems.split(/[\n,]+/).map(item => item.trim()).filter(item => item);

      if (items.length === 0) {
        setError('Please enter valid search terms');
        setLoading(false);
        return;
      }

      console.log('Searching for Instacart items:', items);
      const response = await apiService.searchInstacartItems(items);

      if (response.success) {
        console.log('Search results:', response.results);
        setSearchResults(response.results || []);
        if (response.results.length === 0) {
          setError('No products found. Try different search terms.');
        }
      } else {
        setError(response.message || 'Failed to search for products');
      }
    } catch (err) {
      console.error('Error searching for products:', err);
      setError('Error searching for products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item) => {
    try {
      // Format the item for cart
      const cartItem = {
        name: item.name,
        quantity: 1,
        store_preference: 'instacart',
        details: {
          id: item.id,
          price: item.price,
          brand: item.brand,
          image_url: item.image_url,
          size: item.size,
          retailer: item.retailer
        }
      };

      // Call the parent callback
      onAddToCart(cartItem);
      
      // Show success message
      setSuccessMessage(`Added "${item.name}" to cart`);
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError('Failed to add item to cart');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage('');
  };

  return (
    <Box mt={2}>
      <Typography variant="h6" gutterBottom>
        Search Instacart Products
      </Typography>
      
      <Box mb={2}>
        <TextField
          fullWidth
          label="Enter products (comma or line separated)"
          value={searchItems}
          onChange={(e) => setSearchItems(e.target.value)}
          onKeyPress={handleKeyPress}
          variant="outlined"
          multiline
          rows={2}
          placeholder="e.g. milk, eggs, bread"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSearch}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Search />}
                >
                  Search
                </Button>
              </InputAdornment>
            )
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searching && searchResults.length > 0 && (
        <Box mt={2} mb={2}>
          <Typography variant="subtitle1" gutterBottom>
            Search Results ({searchResults.length})
          </Typography>
          
          <Grid container spacing={2}>
            {searchResults.map((item, index) => (
              <Grid item xs={12} sm={6} md={4} key={`${item.id}-${index}`}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {item.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      {item.brand}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      {item.size}
                    </Typography>
                    
                    <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                      ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                    </Typography>
                    
                    {item.retailer && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        From: {item.retailer}
                      </Typography>
                    )}
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<ShoppingBasket />}
                      onClick={() => handleAddToCart(item)}
                    >
                      Add to Cart
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        message={successMessage}
      />
    </Box>
  );
};

export default InstacartResults;