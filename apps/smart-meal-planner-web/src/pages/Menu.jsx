// meal_planner_frontend/web/src/pages/Menu.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardMedia, CardContent, Button
} from '@mui/material';
import apiService from '../services/apiService';

function Menu() {
  const [menuData, setMenuData] = useState(null);

  const handleGenerateMenu = async () => {
    try {
      const data = await apiService.getGeneratedMenu();
      setMenuData(data);
    } catch (err) {
      console.error('Error generating menu:', err);
    }
  };

  useEffect(() => {
    // Optionally call handleGenerateMenu on load
    // handleGenerateMenu();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Weekly Menu
      </Typography>
      {!menuData && (
        <Button variant="contained" onClick={handleGenerateMenu}>
          Generate Meal Plan
        </Button>
      )}
      {menuData && menuData.days && menuData.days.map((day, idx) => (
        <Box key={idx} sx={{ my: 2 }}>
          <Typography variant="h6">Day {day.dayNumber}</Typography>
          {day.meals && day.meals.map((meal, mIdx) => (
            <Card key={mIdx} sx={{ display: 'flex', my: 1 }}>
              <CardMedia
                component="img"
                sx={{ width: 180 }}
                image="https://via.placeholder.com/180?text=Meal+Photo"
                alt={meal.title}
              />
              <CardContent>
                <Typography variant="subtitle1">{meal.title}</Typography>
                <Typography variant="body2">
                  {meal.instructions}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export default Menu;
