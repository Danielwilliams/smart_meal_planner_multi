import React, { useState, useEffect } from 'react';
import { Box, Chip, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';

const RecipeTagsDisplay = ({ recipe, showTitle = true, size = "small", hideBasicTags = false }) => {
  const [recipeTags, setRecipeTags] = useState([]);
  const [recipePreferences, setRecipePreferences] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

  useEffect(() => {
    if (recipe && recipe.id) {
      fetchRecipeTagsAndPreferences();
    }
  }, [recipe]);

  const fetchRecipeTagsAndPreferences = async () => {
    if (!recipe || !recipe.id) return;
    
    setLoading(true);
    try {
      const [tagsResponse, preferencesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/recipe-admin/tags/${recipe.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          console.log(`No tags found for recipe ${recipe.id}:`, error.message);
          return { data: { success: false, tags: [] } };
        }),
        
        axios.get(`${API_BASE_URL}/recipe-admin/preferences/${recipe.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          console.log(`No preferences found for recipe ${recipe.id}:`, error.message);
          return { data: { success: false, preferences: null } };
        })
      ]);

      if (tagsResponse.data.success) {
        setRecipeTags(tagsResponse.data.tags || []);
      }
      
      if (preferencesResponse.data.success && preferencesResponse.data.preferences) {
        setRecipePreferences(preferencesResponse.data.preferences);
      }
    } catch (error) {
      console.error('Error fetching recipe tags and preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAllTags = () => {
    const chips = [];

    // From recipe database columns (filled variant for DB data)

    // Component Type (Recipe Classification)
    if (recipe.component_type) {
      chips.push(
        <Chip
          key={`db-component`}
          label={recipe.component_type.replace('_', ' ')}
          size={size}
          color="primary"
          variant="filled"
        />
      );
    }

    // Cuisine
    if (recipe.cuisine && !hideBasicTags) {
      chips.push(
        <Chip
          key={`db-cuisine`}
          label={recipe.cuisine}
          size={size}
          color="info"
          variant="filled"
        />
      );
    }

    // Diet Type
    if (recipe.diet_type) {
      chips.push(
        <Chip
          key={`db-diet-type`}
          label={recipe.diet_type}
          size={size}
          color="secondary"
          variant="filled"
        />
      );
    }

    // Recipe Format (cooking method)
    if (recipe.cooking_method) {
      chips.push(
        <Chip
          key={`db-cooking`}
          label={recipe.cooking_method}
          size={size}
          color="success"
          variant="filled"
        />
      );
    }

    // Meal Prep Type
    if (recipe.meal_prep_type) {
      chips.push(
        <Chip
          key={`db-meal-prep`}
          label={recipe.meal_prep_type}
          size={size}
          color="warning"
          variant="filled"
        />
      );
    }

    // Spice Level
    if (recipe.spice_level) {
      chips.push(
        <Chip
          key={`db-spice`}
          label={`Spice: ${recipe.spice_level}`}
          size={size}
          color="error"
          variant="filled"
        />
      );
    }

    // Complexity (only show if not hideBasicTags - recipe cards show this separately)
    if (recipe.complexity && !hideBasicTags) {
      chips.push(
        <Chip
          key={`db-complexity`}
          label={`Complexity: ${recipe.complexity}`}
          size={size}
          color="default"
          variant="filled"
        />
      );
    }

    // Appliances
    if (recipe.appliances && Array.isArray(recipe.appliances) && recipe.appliances.length > 0) {
      recipe.appliances.forEach((appliance, index) => {
        chips.push(
          <Chip
            key={`db-appliance-${index}`}
            label={appliance}
            size={size}
            color="primary"
            variant="outlined"
          />
        );
      });
    }

    // Note: diet_tags and flavor_profile arrays are deprecated
    // All data is now in dedicated columns above

    // From recipe_tags table - only show flavor tags (outlined variant)
    if (recipeTags && recipeTags.length > 0) {
      recipeTags
        .filter(tag => tag.startsWith('flavor_'))
        .forEach((tag, index) => {
          chips.push(
            <Chip
              key={`tag-${index}`}
              label={tag.replace('flavor_', '')}
              size={size}
              color="primary"
              variant="outlined"
            />
          );
        });
    }

    // Note: Legacy preferences and recipe.tags are deprecated
    // All preference data is now in dedicated columns above

    return chips;
  };

  const allChips = renderAllTags();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2">Loading tags...</Typography>
      </Box>
    );
  }

  if (allChips.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: showTitle ? 3 : 0 }}>
      {showTitle && (
        <Typography variant="subtitle1" gutterBottom>
          Tags & Preferences:
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {allChips}
      </Box>
      {showTitle && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Filled: Recipe Properties • Outlined: Custom Flavor Tags
        </Typography>
      )}
    </Box>
  );
};

export default RecipeTagsDisplay;