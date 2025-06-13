// meal_planner_frontend/web/src/pages/Menu.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardMedia, CardContent, Button
} from '@mui/material';
import apiService from '../services/apiService';
import OnboardingWalkthrough from '../components/ImprovedOnboardingWalkthrough';

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
      <Box data-testid="menu-settings-panel" sx={{ mb: 3, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Menu Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your meal plan preferences here (days, people, budget)
        </Typography>
      </Box>
      {!menuData && (
        <Button variant="contained" onClick={handleGenerateMenu} data-testid="generate-menu-button">
          Generate Meal Plan
        </Button>
      )}
      <Box data-testid="menu-display-area">
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
      <OnboardingWalkthrough />
    </Box>
  );
}

export default Menu;
