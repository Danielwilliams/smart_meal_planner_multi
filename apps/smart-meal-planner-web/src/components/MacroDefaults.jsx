import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  TextField, 
  Typography, 
  InputAdornment 
} from '@mui/material';

// Default values for macros
const DEFAULT_MACROS = {
  protein: 40,   // 40% protein
  carbs: 30,     // 30% carbs
  fat: 30,       // 30% fat
  calories: 2000 // 2000 calories per day
};

export default function MacroDefaults({ initialValues, onChange }) {
  const [macros, setMacros] = useState({
    protein: initialValues?.protein || DEFAULT_MACROS.protein,
    carbs: initialValues?.carbs || DEFAULT_MACROS.carbs,
    fat: initialValues?.fat || DEFAULT_MACROS.fat,
    calories: initialValues?.calories || DEFAULT_MACROS.calories
  });

  useEffect(() => {
    onChange?.(macros);
  }, [macros, onChange]);

  const handleMacroChange = (type, value) => {
    // Allow user to clear field for new input
    if (value === '') {
      setMacros(prev => ({
        ...prev,
        [type]: value
      }));
      return;
    }
    
    // Parse user input
    const newValue = parseInt(value);
    
    // Only use default if input is invalid
    if (isNaN(newValue)) {
      setMacros(prev => ({
        ...prev,
        [type]: DEFAULT_MACROS[type]
      }));
      return;
    }
    
    // Use user's value
    setMacros(prev => ({
      ...prev,
      [type]: newValue
    }));
  };

  const calculateTotal = () => {
    return ['protein', 'carbs', 'fat'].reduce((sum, macro) => 
      sum + (parseInt(macros[macro]) || 0), 0
    );
  };

  return (
    <>
      <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Protein (%)"
            fullWidth
            margin="normal"
            type="number"
            value={macros.protein}
            onChange={(e) => handleMacroChange('protein', e.target.value)}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Carbs (%)"
            fullWidth
            margin="normal"
            type="number"
            value={macros.carbs}
            onChange={(e) => handleMacroChange('carbs', e.target.value)}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Fat (%)"
            fullWidth
            margin="normal"
            type="number"
            value={macros.fat}
            onChange={(e) => handleMacroChange('fat', e.target.value)}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Typography 
            variant="body2" 
            color={calculateTotal() === 100 ? "success.main" : "warning.main"}
            sx={{ mt: 1 }}
          >
            {calculateTotal() === 100 
              ? "Perfect! Your macros total 100%" 
              : `Remaining: ${100 - calculateTotal()}%`}
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Daily Calorie Goal"
            fullWidth
            margin="normal"
            type="number"
            value={macros.calories}
            onChange={(e) => handleMacroChange('calories', e.target.value)}
            InputProps={{
              endAdornment: <InputAdornment position="end">kcal/day</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>
    </>
  );
}