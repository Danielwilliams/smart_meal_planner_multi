import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';

/**
 * MacroDisplay component for consistently displaying macronutrient information
 * 
 * @param {Object} props
 * @param {Object} props.macros - The macros object (can be nested with perServing/perMeal or direct)
 * @param {string} props.type - The display type: 'chips', 'text', or 'detailed'
 * @param {boolean} props.showServings - Whether to show servings information (for detailed view)
 * @param {number} props.servings - Number of servings (for detailed view)
 */
const MacroDisplay = ({ macros, type = 'chips', showServings = false, servings = 1 }) => {
  // Helper function to extract macros from different possible structures
  const extractMacros = (macroData) => {
    if (!macroData) return null;
    
    // Handle string JSON
    if (typeof macroData === 'string') {
      try {
        macroData = JSON.parse(macroData);
      } catch (e) {
        console.warn('Failed to parse macros JSON string:', e);
        return null;
      }
    }
    
    // Check different possible structures
    const perServing = macroData.perServing || macroData.per_serving;
    
    // If there's a perServing structure, use that
    if (perServing) {
      return perServing;
    }
    
    // Otherwise assume the macros are directly on the object
    if (macroData.calories || macroData.protein || macroData.carbs || macroData.fat) {
      return macroData;
    }
    
    // No valid macro data found
    return null;
  };
  
  // Normalize a value (handling strings with units)
  const normalizeValue = (value) => {
    if (!value) return 'N/A';
    
    // If it's a number, round it
    if (typeof value === 'number') {
      return Math.round(value);
    }
    
    // If it's a string, try to extract the number part
    if (typeof value === 'string') {
      // Remove any non-numeric characters (except decimal point)
      const numeric = value.replace(/[^\d.]/g, '');
      if (numeric) {
        return Math.round(parseFloat(numeric));
      }
    }
    
    return value;
  };
  
  // Get the extracted macros
  const extractedMacros = extractMacros(macros);
  
  // If no valid macros found
  if (!extractedMacros) {
    return (
      <Typography variant="body2" color="text.secondary">
        No macro information available
      </Typography>
    );
  }
  
  // Format values
  const calories = normalizeValue(extractedMacros.calories);
  const protein = normalizeValue(extractedMacros.protein);
  const carbs = normalizeValue(extractedMacros.carbs);
  const fat = normalizeValue(extractedMacros.fat);
  
  // Chip display
  if (type === 'chips') {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        <Tooltip title="Calories">
          <Chip 
            label={`Cal: ${calories}`} 
            size="small" 
            variant="outlined" 
            color="primary"
          />
        </Tooltip>
        <Tooltip title="Protein">
          <Chip 
            label={`P: ${protein}${typeof protein === 'number' ? 'g' : ''}`} 
            size="small" 
            variant="outlined" 
            color="success"
          />
        </Tooltip>
        <Tooltip title="Carbs">
          <Chip 
            label={`C: ${carbs}${typeof carbs === 'number' ? 'g' : ''}`} 
            size="small" 
            variant="outlined" 
            color="info"
          />
        </Tooltip>
        <Tooltip title="Fat">
          <Chip 
            label={`F: ${fat}${typeof fat === 'number' ? 'g' : ''}`} 
            size="small" 
            variant="outlined" 
            color="warning"
          />
        </Tooltip>
      </Box>
    );
  }
  
  // Text display
  if (type === 'text') {
    return (
      <Typography variant="body2" color="text.secondary">
        {calories} cal | P: {protein}
        {typeof protein === 'number' ? 'g' : ''} | 
        C: {carbs}{typeof carbs === 'number' ? 'g' : ''} | 
        F: {fat}{typeof fat === 'number' ? 'g' : ''}
      </Typography>
    );
  }
  
  // Detailed display
  if (type === 'detailed') {
    // Get per meal values if available
    const perMeal = macros.perMeal || macros.per_meal;
    
    return (
      <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        {showServings && (
          <Typography variant="body2" color="text.secondary">
            <strong>Number of Servings:</strong> {servings}
          </Typography>
        )}
        
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>Per Serving:</strong><br />
            Calories: {calories} |
            Protein: {protein}{typeof protein === 'number' ? 'g' : ''} |
            Carbs: {carbs}{typeof carbs === 'number' ? 'g' : ''} |
            Fat: {fat}{typeof fat === 'number' ? 'g' : ''}
          </Typography>
        </Box>
        
        {perMeal && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Total Recipe ({servings} servings):</strong><br />
            Calories: {normalizeValue(perMeal.calories)} |
            Protein: {normalizeValue(perMeal.protein)}{typeof perMeal.protein === 'number' ? 'g' : ''} |
            Carbs: {normalizeValue(perMeal.carbs)}{typeof perMeal.carbs === 'number' ? 'g' : ''} |
            Fat: {normalizeValue(perMeal.fat)}{typeof perMeal.fat === 'number' ? 'g' : ''}
          </Typography>
        )}
      </Box>
    );
  }
  
  // Default fallback
  return (
    <Typography variant="body2" color="text.secondary">
      Calories: {calories} | P: {protein} | C: {carbs} | F: {fat}
    </Typography>
  );
};

export default MacroDisplay;