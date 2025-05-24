import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Paper,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { 
  AutoAwesome as AiIcon,
  PlayArrow as TestIcon,
  DeleteSweep as ClearIcon,
  Refresh as RefreshIcon,
  TipsAndUpdates as TipsIcon,
  Kitchen as KitchenIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import ShoppingList from '../components/ShoppingList';
import { processShoppingListAI } from '../utils/aiShoppingListFix';

const ShoppingListTestPage = () => {
  const { user } = useAuth();
  const [menuId, setMenuId] = useState('');
  const [promptText, setPromptText] = useState('');
  const [ingredientList, setIngredientList] = useState('');
  const [useCache, setUseCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedStore, setSelectedStore] = useState('mixed');

  // Sample ingredient lists for quick testing
  const sampleIngredients = [
    {
      name: "Basic Meal Ingredients",
      list: `Chicken Breast
Brown Rice
Broccoli
Olive Oil
Garlic
Salt
Pepper
Lemon
Bell Peppers
Onion
Carrots
Spinach
Cheddar Cheese
Eggs
Milk
Butter
Bread
Potatoes`
    },
    {
      name: "Italian Dinner Ingredients",
      list: `Pasta
Tomatoes
Garlic
Basil
Olive Oil
Parmesan Cheese
Ground Beef
Onion
Bell Peppers
Mushrooms
Italian Seasoning
Red Wine
Bread
Butter
Lettuce
Cucumber
Balsamic Vinegar`
    },
    {
      name: "Breakfast Foods",
      list: `Eggs
Bacon
Bread
Butter
Milk
Cereal
Oatmeal
Bananas
Berries
Maple Syrup
Orange Juice
Coffee
Sugar
Yogurt
Granola
Cream Cheese
Bagels
Avocado`
    }
  ];

  // Function to handle adding a sample ingredient list
  const handleAddSample = (index) => {
    setIngredientList(sampleIngredients[index].list);
  };

  // Handle regeneration
  const handleRegenerateList = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Clear the cache first
      try {
        const clearResponse = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-cache`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Cache cleared response:', clearResponse.status);
      } catch (clearError) {
        console.error('Error clearing cache:', clearError);
        // Continue anyway
      }
      
      // Make the API request
      const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menu_id: parseInt(menuId, 10),
          use_ai: true,
          use_cache: false,
          additional_preferences: promptText || undefined
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.status === 'processing') {
          // Need to poll for results
          await pollForResults(menuId);
        } else {
          setResult(data);
        }
      } else {
        setError(`API Error: ${data.detail || 'Unknown error'}`);
        // Try client-side processing as fallback
        handleClientSideProcessing();
      }
    } catch (err) {
      console.error('Error regenerating shopping list:', err);
      setError(`Error: ${err.message}`);
      // Try client-side processing as fallback
      handleClientSideProcessing();
    } finally {
      setLoading(false);
    }
  };

  // Poll for results
  const pollForResults = async (menuId) => {
    let attempts = 0;
    const maxAttempts = 20;
    const pollInterval = 3000; // 3 seconds
    
    const pollFn = async () => {
      try {
        const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const data = await response.json();
        
        if (data.status === 'completed') {
          setResult(data);
          return true;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          setError('Polling timed out. Try manually checking the status.');
          return true;
        }
        
        // Continue polling
        setTimeout(pollFn, pollInterval);
        return false;
      } catch (err) {
        console.error('Error polling for results:', err);
        setError(`Polling error: ${err.message}`);
        return true;
      }
    };
    
    setTimeout(pollFn, pollInterval);
  };

  // Handle direct API test
  const handleDirectTest = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Make the API request
      const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list?use_ai=true&use_cache=${useCache}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(`API Error: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error testing API:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle client-side processing for testing
  const handleClientSideProcessing = () => {
    try {
      // Parse ingredient list into an array
      const ingredients = ingredientList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (ingredients.length === 0) {
        setError('Please enter some ingredients to process');
        return;
      }
      
      // Process with client-side AI
      const processedData = processShoppingListAI(ingredients);
      setResult(processedData);
      
    } catch (err) {
      console.error('Error with client-side processing:', err);
      setError(`Client processing error: ${err.message}`);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shopping List Test Page
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Configuration
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Menu ID"
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              fullWidth
              variant="outlined"
              margin="normal"
              helperText="Enter a menu ID to test the API (or leave empty for client-side testing only)"
            />
            
            <TextField
              label="Additional Preferences (Optional)"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              fullWidth
              variant="outlined"
              margin="normal"
              multiline
              rows={2}
              helperText="Additional context to pass to the AI (e.g., 'I prefer organic', 'Looking for budget options')"
            />
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={useCache} 
                    onChange={(e) => setUseCache(e.target.checked)} 
                  />
                }
                label="Use Cache"
              />
              
              <Box sx={{ ml: 'auto' }}>
                <Button 
                  variant="contained"
                  color="primary"
                  onClick={handleDirectTest}
                  startIcon={<TestIcon />}
                  disabled={!menuId || loading}
                  sx={{ mr: 1 }}
                >
                  Test API
                </Button>
                
                <Button 
                  variant="contained"
                  color="secondary"
                  onClick={handleRegenerateList}
                  startIcon={<RefreshIcon />}
                  disabled={!menuId || loading}
                >
                  Regenerate
                </Button>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Ingredients List (for client-side testing)"
              value={ingredientList}
              onChange={(e) => setIngredientList(e.target.value)}
              fullWidth
              variant="outlined"
              margin="normal"
              multiline
              rows={6}
              helperText="One ingredient per line"
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Box>
                {sampleIngredients.map((sample, index) => (
                  <Button
                    key={index}
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddSample(index)}
                    sx={{ mr: 1 }}
                  >
                    {sample.name}
                  </Button>
                ))}
              </Box>
              
              <Button
                variant="contained"
                color="info"
                onClick={handleClientSideProcessing}
                startIcon={<AiIcon />}
                disabled={!ingredientList || loading}
              >
                Client-Side Processing
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#ffebee' }}>
          <Typography color="error" variant="subtitle1">
            {error}
          </Typography>
        </Paper>
      )}
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Processing shopping list...
          </Typography>
        </Box>
      )}
      
      {result && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Results
                {result.cached && (
                  <Typography component="span" variant="caption" sx={{ ml: 1, bgcolor: '#e3f2fd', p: 0.5, borderRadius: 1 }}>
                    CACHED
                  </Typography>
                )}
              </Typography>
              
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setResult(null)}
                  startIcon={<ClearIcon />}
                  sx={{ mr: 1 }}
                >
                  Clear Results
                </Button>
              </Box>
            </Box>
            
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Shopping List" />
              <Tab label="Raw Data" />
              <Tab label="Tips & Alternatives" />
            </Tabs>
            
            <Box sx={{ mt: 2 }}>
              {activeTab === 0 && (
                <ShoppingList
                  categories={result.groceryList}
                  selectedStore={selectedStore}
                  onAddToCart={() => {}}
                  onAddToMixedCart={() => {}}
                  healthyAlternatives={result.healthyAlternatives || []}
                  shoppingTips={result.shoppingTips || []}
                />
              )}
              
              {activeTab === 1 && (
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, maxHeight: '500px', overflow: 'auto' }}>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </Box>
              )}
              
              {activeTab === 2 && (
                <Grid container spacing={3}>
                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <TagIcon sx={{ mr: 1 }} color="primary" />
                            <Typography variant="h6">Recommendations</Typography>
                          </Box>
                          <List dense>
                            {result.recommendations.map((item, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><TagIcon color="primary" /></ListItemIcon>
                                <ListItemText primary={item} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {/* Nutrition Tips */}
                  {result.nutritionTips && result.nutritionTips.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <TipsIcon sx={{ mr: 1 }} color="secondary" />
                            <Typography variant="h6">Nutrition Tips</Typography>
                          </Box>
                          <List dense>
                            {result.nutritionTips.map((tip, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><TipsIcon color="secondary" /></ListItemIcon>
                                <ListItemText primary={tip} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {/* Shopping Tips */}
                  {result.shoppingTips && result.shoppingTips.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <KitchenIcon sx={{ mr: 1 }} color="info" />
                            <Typography variant="h6">Shopping Tips</Typography>
                          </Box>
                          <List dense>
                            {result.shoppingTips.map((tip, index) => (
                              <ListItem key={index}>
                                <ListItemIcon><KitchenIcon color="info" /></ListItemIcon>
                                <ListItemText primary={tip} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {/* Healthy Alternatives */}
                  {result.healthyAlternatives && result.healthyAlternatives.length > 0 && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1}>
                            <AiIcon sx={{ mr: 1 }} color="success" />
                            <Typography variant="h6">Healthy Alternatives</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            {result.healthyAlternatives.map((alt, index) => (
                              <Grid item xs={12} md={4} key={index}>
                                <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle1" color="primary">{alt.original}</Typography>
                                  <Typography variant="body1">→ {alt.alternative}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {alt.benefit}
                                  </Typography>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default ShoppingListTestPage;