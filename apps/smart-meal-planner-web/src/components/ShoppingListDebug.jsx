// src/components/ShoppingListDebug.jsx

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// Import the combineItems function exported from ShoppingList
import { combineItems } from './ShoppingList';

/**
 * Debug component for ShoppingList to help analyze data and processing issues
 */
const ShoppingListDebug = ({ groceryData }) => {
  const [expanded, setExpanded] = useState('panel1');
  const [debugInput, setDebugInput] = useState('');
  const [debugResult, setDebugResult] = useState([]);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Function to process the input from the text area
  const processDebugInput = () => {
    try {
      let inputData;
      
      // Try to parse JSON input
      try {
        inputData = JSON.parse(debugInput);
      } catch (parseError) {
        // If not valid JSON, try to extract from the raw text
        // Look for ingredients in the form of "name: quantity"
        const lines = debugInput.split('\n');
        inputData = lines.filter(line => line.trim().length > 0);
      }
      
      // Process the data through the combineItems function
      const result = combineItems(Array.isArray(inputData) ? inputData : [inputData]);
      setDebugResult(result);
    } catch (error) {
      console.error('Error processing debug input:', error);
      setDebugResult([`Error: ${error.message}`]);
    }
  };

  // Get flat list of ingredients from the grocery data
  const extractIngredients = (data) => {
    if (!data) return [];
    
    let flatList = [];
    
    // Handle direct array of strings
    if (Array.isArray(data)) {
      flatList = [...data];
    } 
    // Handle categorized format
    else if (typeof data === 'object') {
      Object.values(data).forEach(items => {
        if (Array.isArray(items)) {
          flatList = [...flatList, ...items];
        }
      });
    }
    
    return flatList;
  };

  // Process ingredients from the menu structure
  const extractIngredientsFromMenu = (menu) => {
    if (!menu || !menu.days) return [];
    
    const ingredients = [];
    
    // Process days
    menu.days.forEach(day => {
      // Process meals
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              if (typeof ing === 'object' && ing.name) {
                ingredients.push({
                  name: ing.name,
                  quantity: ing.quantity,
                  originalFormat: `${ing.name}: ${ing.quantity}`
                });
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
                ingredients.push({
                  name: ing.name,
                  quantity: ing.quantity,
                  originalFormat: `${ing.name}: ${ing.quantity}`
                });
              }
            });
          }
        });
      }
    });
    
    return ingredients;
  };

  // Extract ingredients from the current grocery data
  const ingredients = extractIngredients(groceryData);
  const menuIngredients = groceryData && groceryData.days ? 
    extractIngredientsFromMenu(groceryData) : [];

  return (
    <Paper elevation={3} sx={{ my: 2, p: 2, mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        🔧 Shopping List Debug
      </Typography>
      
      <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content"
          id="panel1-header"
        >
          <Typography>Raw Grocery Data</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Data Type: {typeof groceryData} | Array: {Array.isArray(groceryData).toString()} | Keys: {typeof groceryData === 'object' ? Object.keys(groceryData).join(', ') : 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {JSON.stringify(groceryData, null, 2)}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel2-content"
          id="panel2-header"
        >
          <Typography>Extracted Ingredients ({ingredients.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Properties</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ingredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No ingredients found</TableCell>
                  </TableRow>
                ) : (
                  ingredients.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {typeof item === 'string' ? item : (item.name || JSON.stringify(item))}
                      </TableCell>
                      <TableCell>{typeof item}</TableCell>
                      <TableCell>
                        {typeof item === 'object' && item !== null ? 
                          Object.keys(item).join(', ') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
      
      <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel3-content"
          id="panel3-header"
        >
          <Typography>Menu Structure Ingredients ({menuIngredients.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Original Format</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {menuIngredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No ingredients found in menu structure</TableCell>
                  </TableRow>
                ) : (
                  menuIngredients.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.originalFormat}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
      
      <Accordion expanded={expanded === 'panel4'} onChange={handleChange('panel4')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel4-content"
          id="panel4-header"
        >
          <Typography>Processing Test</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Enter ingredients to test (line by line or as JSON)
            </Typography>
            <TextField
              multiline
              fullWidth
              rows={6}
              variant="outlined"
              placeholder='Example:
Chicken Breast: 16 oz
Bell Peppers: 1 cup
Garlic: 2 cloves'
              value={debugInput}
              onChange={(e) => setDebugInput(e.target.value)}
              sx={{ mb: 2, fontFamily: 'monospace' }}
            />
            <Button 
              variant="contained" 
              onClick={processDebugInput}
              sx={{ mb: 2 }}
            >
              Process
            </Button>
            
            <Typography variant="subtitle2" gutterBottom>
              Results:
            </Typography>
            <Box 
              sx={{ 
                p: 2, 
                border: '1px solid #ddd', 
                borderRadius: 1, 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                bgcolor: '#f5f5f5'
              }}
            >
              {debugResult.length === 0 ? (
                'No results yet'
              ) : (
                debugResult.map((item, index) => (
                  <div key={index}>{item}</div>
                ))
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion expanded={expanded === 'panel5'} onChange={handleChange('panel5')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel5-content"
          id="panel5-header"
        >
          <Typography>Expected Output</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              For debugging, the shopping list should show:
            </Typography>
            <Box 
              sx={{ 
                p: 2, 
                border: '1px solid #ddd', 
                borderRadius: 1, 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                bgcolor: '#f5f5f5'
              }}
            >
              {`Chicken: 96oz
Beef Sirloin: 16oz
Bell Peppers: 3
Greek Yogurt: 5 cups
Quinoa: 3 cups cooked
Rice: 2 cups cooked
Garlic: 6 cloves
Olive Oil: 3 tbsp
Sesame Oil: 1 tbsp
`}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Box sx={{ mt: 2 }}>
        <Button 
          variant="outlined" 
          onClick={() => {
            // Copy the current raw data to the test panel
            setDebugInput(JSON.stringify(groceryData, null, 2));
            setExpanded('panel4');
          }}
        >
          Copy Data to Test Area
        </Button>
      </Box>
    </Paper>
  );
};

export default ShoppingListDebug;