// src/components/MenuDefaultsSettings.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Slider,
  Paper,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  RestoreOutlined as RestoreIcon,
  Info as InfoIcon,
  Dining as DiningIcon,
  Schedule as ScheduleIcon,
  TuneOutlined as TuneIcon,
  LocalDining as LocalDiningIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

const MenuDefaultsSettings = () => {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [menuDefaults, setMenuDefaults] = useState({
    default_planning_period: 7,
    default_meals_per_day: 3,
    include_snacks: true,
    default_snacks_per_day: 1,
    serving_sizes: {
      breakfast: 1,
      lunch: 1,
      dinner: 1,
      snacks: 1
    },
    nutritional_targets: {
      caloriesPerMeal: { min: 300, max: 800 },
      proteinPercentage: { min: 15, max: 35 },
      carbsPercentage: { min: 45, max: 65 },
      fatPercentage: { min: 20, max: 35 }
    },
    dietary_defaults: {
      allowedCuisines: ['american', 'italian', 'mexican'],
      restrictedIngredients: [],
      preferredCookingMethods: ['baking', 'grilling', 'sautéing'],
      maxPrepTime: 45
    },
    client_delivery_settings: {
      requireApproval: true,
      autoGenerateShoppingList: true,
      includeNutritionalInfo: true,
      includePrepInstructions: true
    }
  });

  const cuisineOptions = [
    'american', 'italian', 'mexican', 'asian', 'mediterranean', 'indian',
    'french', 'greek', 'japanese', 'thai', 'chinese', 'korean', 'spanish',
    'middle-eastern', 'vietnamese', 'brazilian', 'caribbean'
  ];

  const cookingMethodOptions = [
    'baking', 'grilling', 'sautéing', 'roasting', 'steaming', 'boiling',
    'frying', 'slow-cooking', 'pressure-cooking', 'raw'
  ];

  useEffect(() => {
    if (organization?.id) {
      loadMenuDefaults();
    }
  }, [organization?.id]);

  const loadMenuDefaults = async () => {
    try {
      setLoading(true);
      const response = await apiService.request(
        `/api/organization-recipes/${organization.id}/menu-defaults`,
        { method: 'GET' }
      );
      
      setMenuDefaults(response);
    } catch (err) {
      console.error('Error loading menu defaults:', err);
      setError('Failed to load menu defaults');
    } finally {
      setLoading(false);
    }
  };

  const saveMenuDefaults = async () => {
    try {
      setSaving(true);
      setError('');
      
      await apiService.request(
        `/api/organization-recipes/${organization.id}/menu-defaults`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(menuDefaults)
        }
      );
      
      setSuccess('Menu defaults saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving menu defaults:', err);
      setError('Failed to save menu defaults');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setMenuDefaults({
      default_planning_period: 7,
      default_meals_per_day: 3,
      include_snacks: true,
      default_snacks_per_day: 1,
      serving_sizes: {
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        snacks: 1
      },
      nutritional_targets: {
        caloriesPerMeal: { min: 300, max: 800 },
        proteinPercentage: { min: 15, max: 35 },
        carbsPercentage: { min: 45, max: 65 },
        fatPercentage: { min: 20, max: 35 }
      },
      dietary_defaults: {
        allowedCuisines: ['american', 'italian', 'mexican'],
        restrictedIngredients: [],
        preferredCookingMethods: ['baking', 'grilling', 'sautéing'],
        maxPrepTime: 45
      },
      client_delivery_settings: {
        requireApproval: true,
        autoGenerateShoppingList: true,
        includeNutritionalInfo: true,
        includePrepInstructions: true
      }
    });
  };

  const updateServingSize = (meal, value) => {
    setMenuDefaults(prev => ({
      ...prev,
      serving_sizes: {
        ...prev.serving_sizes,
        [meal]: value
      }
    }));
  };

  const updateNutritionalTarget = (nutrient, type, value) => {
    setMenuDefaults(prev => ({
      ...prev,
      nutritional_targets: {
        ...prev.nutritional_targets,
        [nutrient]: {
          ...prev.nutritional_targets[nutrient],
          [type]: value
        }
      }
    }));
  };

  const updateDietaryDefaults = (key, value) => {
    setMenuDefaults(prev => ({
      ...prev,
      dietary_defaults: {
        ...prev.dietary_defaults,
        [key]: value
      }
    }));
  };

  const updateClientDeliverySettings = (key, value) => {
    setMenuDefaults(prev => ({
      ...prev,
      client_delivery_settings: {
        ...prev.client_delivery_settings,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Menu Defaults...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              Menu Defaults
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure default parameters for client menu generation
            </Typography>
          </Box>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={resetToDefaults}
              sx={{ mr: 2 }}
            >
              Reset to Defaults
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveMenuDefaults}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Basic Menu Parameters */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center">
            <ScheduleIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Basic Menu Parameters</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Planning Period</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Default Planning Period (days)"
                    value={menuDefaults.default_planning_period}
                    onChange={(e) => setMenuDefaults(prev => ({
                      ...prev,
                      default_planning_period: parseInt(e.target.value) || 7
                    }))}
                    inputProps={{ min: 1, max: 30 }}
                    helperText="How many days to plan meals for by default"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Meals Per Day</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Default Meals Per Day"
                    value={menuDefaults.default_meals_per_day}
                    onChange={(e) => setMenuDefaults(prev => ({
                      ...prev,
                      default_meals_per_day: parseInt(e.target.value) || 3
                    }))}
                    inputProps={{ min: 1, max: 6 }}
                    helperText="Number of main meals to plan each day"
                  />
                  
                  <Box mt={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={menuDefaults.include_snacks}
                          onChange={(e) => setMenuDefaults(prev => ({
                            ...prev,
                            include_snacks: e.target.checked
                          }))}
                        />
                      }
                      label="Include Snacks"
                    />
                  </Box>
                  
                  {menuDefaults.include_snacks && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Snacks Per Day"
                      value={menuDefaults.default_snacks_per_day}
                      onChange={(e) => setMenuDefaults(prev => ({
                        ...prev,
                        default_snacks_per_day: parseInt(e.target.value) || 1
                      }))}
                      inputProps={{ min: 0, max: 5 }}
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Serving Sizes */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center">
            <LocalDiningIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Default Serving Sizes</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {Object.entries(menuDefaults.serving_sizes).map(([meal, size]) => (
              <Grid item xs={12} md={3} key={meal}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }} gutterBottom>
                      {meal}
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      label="Servings"
                      value={size}
                      onChange={(e) => updateServingSize(meal, parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 10 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Nutritional Targets */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center">
            <TuneIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Nutritional Targets</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {/* Calories Per Meal */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Calories Per Meal</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography gutterBottom>
                      Range: {menuDefaults.nutritional_targets.caloriesPerMeal.min} - {menuDefaults.nutritional_targets.caloriesPerMeal.max} calories
                    </Typography>
                    <Slider
                      value={[
                        menuDefaults.nutritional_targets.caloriesPerMeal.min,
                        menuDefaults.nutritional_targets.caloriesPerMeal.max
                      ]}
                      onChange={(e, newValue) => {
                        updateNutritionalTarget('caloriesPerMeal', 'min', newValue[0]);
                        updateNutritionalTarget('caloriesPerMeal', 'max', newValue[1]);
                      }}
                      min={200}
                      max={1200}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Macronutrient Percentages */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Macronutrient Targets (%)</Typography>
                  
                  {['proteinPercentage', 'carbsPercentage', 'fatPercentage'].map((nutrient) => {
                    const label = nutrient.replace('Percentage', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                      <Box key={nutrient} sx={{ mt: 2 }}>
                        <Typography gutterBottom>
                          {label}: {menuDefaults.nutritional_targets[nutrient].min}% - {menuDefaults.nutritional_targets[nutrient].max}%
                        </Typography>
                        <Slider
                          value={[
                            menuDefaults.nutritional_targets[nutrient].min,
                            menuDefaults.nutritional_targets[nutrient].max
                          ]}
                          onChange={(e, newValue) => {
                            updateNutritionalTarget(nutrient, 'min', newValue[0]);
                            updateNutritionalTarget(nutrient, 'max', newValue[1]);
                          }}
                          min={0}
                          max={100}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    );
                  })}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Dietary Preferences */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center">
            <DiningIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Dietary Defaults</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {/* Allowed Cuisines */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Allowed Cuisines</Typography>
                  <Box sx={{ mt: 2 }}>
                    {cuisineOptions.map((cuisine) => (
                      <FormControlLabel
                        key={cuisine}
                        control={
                          <Switch
                            checked={menuDefaults.dietary_defaults.allowedCuisines.includes(cuisine)}
                            onChange={(e) => {
                              const newCuisines = e.target.checked
                                ? [...menuDefaults.dietary_defaults.allowedCuisines, cuisine]
                                : menuDefaults.dietary_defaults.allowedCuisines.filter(c => c !== cuisine);
                              updateDietaryDefaults('allowedCuisines', newCuisines);
                            }}
                          />
                        }
                        label={cuisine.charAt(0).toUpperCase() + cuisine.slice(1).replace('-', ' ')}
                        sx={{ display: 'block' }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Cooking Methods */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Preferred Cooking Methods</Typography>
                  <Box sx={{ mt: 2 }}>
                    {cookingMethodOptions.map((method) => (
                      <FormControlLabel
                        key={method}
                        control={
                          <Switch
                            checked={menuDefaults.dietary_defaults.preferredCookingMethods.includes(method)}
                            onChange={(e) => {
                              const newMethods = e.target.checked
                                ? [...menuDefaults.dietary_defaults.preferredCookingMethods, method]
                                : menuDefaults.dietary_defaults.preferredCookingMethods.filter(m => m !== method);
                              updateDietaryDefaults('preferredCookingMethods', newMethods);
                            }}
                          />
                        }
                        label={method.charAt(0).toUpperCase() + method.slice(1).replace('-', ' ')}
                        sx={{ display: 'block' }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Max Prep Time */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Maximum Preparation Time</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography gutterBottom>
                      Max Prep Time: {menuDefaults.dietary_defaults.maxPrepTime} minutes
                    </Typography>
                    <Slider
                      value={menuDefaults.dietary_defaults.maxPrepTime}
                      onChange={(e, newValue) => updateDietaryDefaults('maxPrepTime', newValue)}
                      min={15}
                      max={120}
                      step={15}
                      marks={[
                        { value: 15, label: '15min' },
                        { value: 30, label: '30min' },
                        { value: 45, label: '45min' },
                        { value: 60, label: '1hr' },
                        { value: 90, label: '1.5hr' },
                        { value: 120, label: '2hr' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Client Delivery Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center">
            <PsychologyIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Client Delivery Settings</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Default Client Delivery Options</Typography>
              
              <List>
                <ListItem>
                  <ListItemText
                    primary="Require Approval"
                    secondary="Menus must be approved before delivery to clients"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={menuDefaults.client_delivery_settings.requireApproval}
                      onChange={(e) => updateClientDeliverySettings('requireApproval', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemText
                    primary="Auto-Generate Shopping Lists"
                    secondary="Automatically create shopping lists with menus"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={menuDefaults.client_delivery_settings.autoGenerateShoppingList}
                      onChange={(e) => updateClientDeliverySettings('autoGenerateShoppingList', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemText
                    primary="Include Nutritional Information"
                    secondary="Show nutritional data with recipes"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={menuDefaults.client_delivery_settings.includeNutritionalInfo}
                      onChange={(e) => updateClientDeliverySettings('includeNutritionalInfo', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemText
                    primary="Include Preparation Instructions"
                    secondary="Show cooking instructions with recipes"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={menuDefaults.client_delivery_settings.includePrepInstructions}
                      onChange={(e) => updateClientDeliverySettings('includePrepInstructions', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>

      {/* Save Button at Bottom */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={saveMenuDefaults}
          disabled={saving}
        >
          {saving ? 'Saving Changes...' : 'Save Menu Defaults'}
        </Button>
      </Box>
    </Box>
  );
};

export default MenuDefaultsSettings;