// meal_planner_frontend/web/src/pages/Preferences.jsx
import React, { useState } from 'react';
import {
  Box, Typography, FormControlLabel, Checkbox, TextField, Button
} from '@mui/material';

function Preferences() {
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [dislikedFoods, setDislikedFoods] = useState('');

  const handleSubmit = () => {
    console.log('Preferences:', { isGlutenFree, dislikedFoods });
    // call an API or store locally
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Your Dietary Preferences
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={isGlutenFree}
            onChange={(e) => setIsGlutenFree(e.target.checked)}
          />
        }
        label="Gluten-Free"
      />
      <Box sx={{ my: 2 }}>
        <TextField
          label="Disliked Foods"
          fullWidth
          value={dislikedFoods}
          onChange={(e) => setDislikedFoods(e.target.value)}
          helperText="Comma separated (e.g. onions, shrimp)"
        />
      </Box>
      <Button variant="contained" onClick={handleSubmit}>
        Save Preferences
      </Button>
    </Box>
  );
}

export default Preferences;
