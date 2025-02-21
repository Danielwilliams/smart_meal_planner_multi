// src/components/KrogerResults.jsx
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Grid, 
  Box,
  IconButton
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import AddIcon from '@mui/icons-material/Add';

const KrogerResults = ({ results, onAddToCart }) => {
  const [selectedItems, setSelectedItems] = useState(new Set());

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

  const handleAddSelectedToCart = () => {
    const itemsToAdd = results.filter(item => selectedItems.has(item.upc));
    onAddToCart(itemsToAdd);
    setSelectedItems(new Set()); // Clear selections after adding to cart
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
        {results.map((item) => (
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
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" component="div" sx={{ fontSize: '1rem' }}>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.brand}
                    </Typography>
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
                  mt: 2 
                }}>
                  <Typography variant="h6" color="primary">
                    ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.size}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {results.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No products found matching your search.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default KrogerResults;