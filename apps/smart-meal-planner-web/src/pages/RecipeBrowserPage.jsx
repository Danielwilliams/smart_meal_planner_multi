import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Grid, Card, CardMedia, CardContent, 
  CardActions, Button, TextField, MenuItem, Select, FormControl,
  InputLabel, Pagination, Box, Chip, CircularProgress, IconButton
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const RecipeBrowserPage = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipesPerPage, setRecipesPerPage] = useState(12);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState({
    cuisine: '',
    complexity: '',
    tags: ''
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('info');

  useEffect(() => {
    fetchRecipes();
  }, [page, filters]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * recipesPerPage;
      
      console.log(`Fetching page ${page} of recipes (offset=${offset}, limit=${recipesPerPage})`);
      console.log('Filters:', filters);
      
      // Include search query in filters if it exists
      const searchParams = {
        ...filters,
        limit: recipesPerPage,
        offset: offset
      };
      
      if (searchQuery && isSearching) {
        searchParams.search = searchQuery;
      }
      
      console.log('Search params:', searchParams);
      
      const response = await apiService.getScrapedRecipes(searchParams);
      
      console.log('API Response:', response);
      console.log(`Received ${response.recipes?.length} recipes`);
      
      if (response.recipes?.length > 0) {
        const firstId = response.recipes[0].id;
        const lastId = response.recipes[response.recipes.length-1].id;
        console.log(`ID range in this page: ${firstId} to ${lastId}`);
        console.log('Pagination debug:');
        console.log(`Current page: ${page}, Items per page: ${recipesPerPage}`);
        console.log(`Offset used: ${(page - 1) * recipesPerPage}`);
        console.log(`Total recipes reported by API: ${response.total}`);
        console.log(`Actual recipes received: ${response.recipes?.length}`);
        console.log(`Recipe IDs in this page:`, response.recipes.map(r => r.id));
        
        // Check for gaps in the current page
        const ids = response.recipes.map(r => r.id).sort((a, b) => a - b);
        for (let i = 1; i < ids.length; i++) {
          if (ids[i] - ids[i-1] > 1) {
            console.log(`Gap detected between IDs ${ids[i-1]} and ${ids[i]}`);
          }
        }
      }
      
      setRecipes(response.recipes || []);
      setTotal(response.total || 0);
      setTotalRecipes(response.total || 0);
    } catch (err) {
      console.error('Error fetching recipes:', err);
      setError(`Failed to load recipes: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setIsSearching(!!searchQuery);
    fetchRecipes();
  };

  const handleFilterChange = (name, value) => {
    setFilters({
      ...filters,
      [name]: value
    });
    setPage(1);
    setIsSearching(false);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleSaveRecipe = async (recipe, event) => {
    event.stopPropagation();
    event.preventDefault();
    
    try {
      if (recipe.is_saved) {
        // Unsave the recipe
        await apiService.unsaveRecipe(recipe.saved_id);
        
        // Update local state
        setRecipes(recipes.map(r => 
          r.id === recipe.id ? {...r, is_saved: false, saved_id: null} : r
        ));
      } else {
        // Save the recipe
        const response = await apiService.saveRecipe({
          scraped_recipe_id: recipe.id,
          recipe_name: recipe.title
        });
        
        // Update local state
        setRecipes(recipes.map(r => 
          r.id === recipe.id ? {...r, is_saved: true, saved_id: response.saved_id} : r
        ));
      }
    } catch (err) {
      console.error('Error saving/unsaving recipe:', err);
      setError('Failed to save/unsave recipe. Please try again later.');
    }
  };

  const verifyRecipeCount = async () => {
    try {
      const countResponse = await apiService.getRecipeCount();
      console.log(`Direct count API shows ${countResponse} total recipes`);
      console.log(`Current pagination shows ${totalRecipes} total recipes`);
      
      if (countResponse !== totalRecipes) {
        console.warn('⚠️ Mismatch between pagination total and direct count!');
        // Update to the correct count
        setTotalRecipes(countResponse);
        showAlert(`Updated recipe count from ${totalRecipes} to ${countResponse}`, 'info');
        
        // Log max possible page number
        const maxPages = Math.ceil(countResponse / recipesPerPage);
        console.log(`Maximum page number should be: ${maxPages}`);
      }
    } catch (error) {
      console.error('Error verifying recipe count:', error);
    }
  };  

  // Call this function after the initial data fetch
  useEffect(() => {
    if (recipes.length > 0 && !loading) {
      verifyRecipeCount();
    }
  }, [recipes, loading]);
  
  const renderComplexityColor = (complexity) => {
    switch (complexity) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'complex':
        return 'error';
      default:
        return 'default';
    }
  };

  const showAlert = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setAlertOpen(true);
  };

  const totalPages = Math.ceil(total / limit);

  const handleAlertClose = () => {
    setAlertOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Recipe Browser
      </Typography>
      
      <Box 
        sx={{ 
          mb: 4, 
          '@media (max-width:600px)': { 
            mb: 2
          } 
        }}
      >
        <Grid container spacing={2} alignItems="flex-end">
          {/* Search input - full width on mobile */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search recipes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
              sx={{
                mb: { xs: 2, md: 0 }
              }}
            />
          </Grid>
          
          {/* Filters - stacked on mobile, side by side on desktop */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Complexity</InputLabel>
              <Select
                value={filters.complexity}
                label="Complexity"
                onChange={(e) => handleFilterChange('complexity', e.target.value)}
                sx={{ 
                  '@media (max-width:600px)': { 
                    height: '56px' // Larger touch target on mobile
                  }
                }}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="complex">Complex</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Cuisine</InputLabel>
              <Select
                value={filters.cuisine}
                label="Cuisine"
                onChange={(e) => handleFilterChange('cuisine', e.target.value)}
                sx={{ 
                  '@media (max-width:600px)': { 
                    height: '56px' // Larger touch target on mobile
                  }
                }}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="italian">Italian</MenuItem>
                <MenuItem value="mexican">Mexican</MenuItem>
                <MenuItem value="chinese">Chinese</MenuItem>
                <MenuItem value="indian">Indian</MenuItem>
                <MenuItem value="american">American</MenuItem>
                <MenuItem value="mediterranean">Mediterranean</MenuItem>
                <MenuItem value="french">French</MenuItem>
                <MenuItem value="japanese">Japanese</MenuItem>
                <MenuItem value="thai">Thai</MenuItem>
                <MenuItem value="greek">Greek</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Tag</InputLabel>
              <Select
                value={filters.tags}
                label="Tag"
                onChange={(e) => handleFilterChange('tags', e.target.value)}
                sx={{ 
                  '@media (max-width:600px)': { 
                    height: '56px' // Larger touch target on mobile
                  }
                }}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="vegetarian">Vegetarian</MenuItem>
                <MenuItem value="vegan">Vegan</MenuItem>
                <MenuItem value="gluten-free">Gluten-Free</MenuItem>
                <MenuItem value="quick">Quick</MenuItem>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="dessert">Dessert</MenuItem>
                <MenuItem value="breakfast">Breakfast</MenuItem>
                <MenuItem value="lunch">Lunch</MenuItem>
                <MenuItem value="dinner">Dinner</MenuItem>
                <MenuItem value="healthy">Healthy</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleSearch}
              fullWidth
              sx={{ 
                '@media (max-width:600px)': { 
                  height: '56px', // Larger touch target on mobile
                  mt: 1
                }
              }}
            >
              Search
            </Button>
          </Grid>
          
          {/* Active filters display */}
          <Grid item xs={12}>
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              flexWrap: 'wrap',
              '@media (max-width:600px)': {
                justifyContent: 'center'
              }
            }}>
              {filters.cuisine && (
                <Chip 
                  label={`Cuisine: ${filters.cuisine}`} 
                  onDelete={() => handleFilterChange('cuisine', '')}
                  sx={{ 
                    mr: 1, 
                    mb: 1,
                    '@media (max-width:600px)': {
                      height: '36px' // Larger touch target on mobile
                    }
                  }}
                />
              )}
              {filters.complexity && (
                <Chip 
                  label={`Complexity: ${filters.complexity}`} 
                  onDelete={() => handleFilterChange('complexity', '')}
                  sx={{ 
                    mr: 1, 
                    mb: 1,
                    '@media (max-width:600px)': {
                      height: '36px' // Larger touch target on mobile
                    }
                  }}
                />
              )}
              {filters.tags && (
                <Chip 
                  label={`Tag: ${filters.tags}`} 
                  onDelete={() => handleFilterChange('tags', '')}
                  sx={{ 
                    mr: 1, 
                    mb: 1,
                    '@media (max-width:600px)': {
                      height: '36px' // Larger touch target on mobile
                    }
                  }}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          <Grid container spacing={3}>
            {recipes.length > 0 ? (
              recipes.map((recipe) => (
                <Grid item key={recipe.id} xs={12} sm={6} md={4}>
                  <Card 
                    component={Link} 
                    to={`/recipes/${recipe.id}`}
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-in-out',
                      textDecoration: 'none', // Remove underline from Link
                      color: 'inherit', // Keep default text color
                      '@media (max-width:600px)': {
                        minHeight: '200px', // Taller cards on mobile
                      },
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
                      }
                    }}
                  >
                    {recipe.image_url ? (
                      <CardMedia
                        component="img"
                        height="160"
                        image={recipe.image_url}
                        alt={recipe.title}
                        sx={{ 
                          objectFit: 'cover',
                          '@media (max-width:600px)': {
                            height: '200px',
                          },
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 160,
                          backgroundColor: 'action.selected',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          '@media (max-width:600px)': {
                            height: '200px',
                          },
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          No image available
                        </Typography>
                      </Box>
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="div" gutterBottom noWrap>
                        {recipe.title}
                      </Typography>
                      <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip 
                          size="small" 
                          label={recipe.complexity || 'Unknown'} 
                          color={renderComplexityColor(recipe.complexity)}
                        />
                        {recipe.cuisine && (
                          <Chip 
                            size="small" 
                            label={recipe.cuisine} 
                            variant="outlined"
                          />
                        )}
                        <Chip 
                          size="small" 
                          label={recipe.source} 
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {recipe.prep_time && `Prep: ${recipe.prep_time} mins`}
                        {recipe.cook_time && recipe.prep_time && ' • '}
                        {recipe.cook_time && `Cook: ${recipe.cook_time} mins`}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'space-between' }}>
                      <Button 
                        component={Link}
                        to={`/recipes/${recipe.id}`}
                        size="small"
                      >
                        View Details
                      </Button>
                      <IconButton
                        color="primary"
                        onClick={(e) => handleSaveRecipe(recipe, e)}
                        aria-label={recipe.is_saved ? "Unsave recipe" : "Save recipe"}
                      >
                        {recipe.is_saved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Typography align="center">No recipes found matching your criteria.</Typography>
              </Grid>
            )}
          </Grid>
          
          {totalPages > 1 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'center', 
              alignItems: 'center', 
              mt: 4,
              gap: { xs: 2, sm: 0 }
            }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange}
                color="primary"
                size="large"
                sx={{
                  '& .MuiPaginationItem-root': {
                    '@media (max-width:600px)': {
                      minWidth: '40px',
                      height: '40px',
                    }
                  }
                }}
              />
              <Box sx={{ 
                ml: { xs: 0, sm: 2 }, 
                display: 'flex', 
                alignItems: 'center'
              }}>
                <TextField
                  size="small"
                  label="Go to page"
                  type="number"
                  InputProps={{ 
                    inputProps: { 
                      min: 1, 
                      max: totalPages 
                    } 
                  }}
                  sx={{ 
                    width: { xs: 120, sm: 100 },
                    '& .MuiInputBase-root': {
                      '@media (max-width:600px)': {
                        height: '48px',
                      }
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const targetPage = parseInt(e.target.value);
                      if (targetPage >= 1 && targetPage <= totalPages) {
                        handlePageChange(null, targetPage);
                      }
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </>
      )}
      
      <Snackbar 
        open={alertOpen} 
        autoHideDuration={6000} 
        onClose={handleAlertClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleAlertClose} 
          severity={alertSeverity} 
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default RecipeBrowserPage;