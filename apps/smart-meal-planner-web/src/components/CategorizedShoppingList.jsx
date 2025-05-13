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
  const getItemsByCategory = () => {
    if (!groceryData || !groceryData.groceryList || !Array.isArray(groceryData.groceryList)) {
      return {};
    }

    // Group items by their category
    const categorized = {};
    groceryData.groceryList.forEach(item => {
      const category = item.category || 'Other';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(`${item.name}: ${item.quantity}`);
    });

    return categorized;
  };

  // Get color for category
  const getCategoryColor = (category) => {
    const colors = {
      'Protein': '#F44336', // Red
      'Produce': '#4CAF50', // Green
      'Dairy': '#2196F3',   // Blue
      'Grains': '#FF9800',  // Orange
      'Pantry': '#795548',  // Brown
      'Condiments': '#9C27B0', // Purple
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
                            onClick={() => onAddToCart && onAddToCart(item.split(':')[0].trim(), selectedStore)}
                          >
                            Add
                          </Button>
                        }
                      >
                        <ListItemText primary={item} />
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