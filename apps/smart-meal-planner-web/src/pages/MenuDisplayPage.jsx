// src/pages/MenuDisplayPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

// MUI Components
import { 
  Container, Typography, Button, Box, Paper, 
  Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Accordion, AccordionSummary, 
  AccordionDetails, TextField, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions,
  FormGroup, FormControlLabel, Checkbox, Grid, Chip,
  Snackbar, Radio, RadioGroup
} from '@mui/material';

// MUI Icons
import { 
  ExpandMore as ExpandMoreIcon, 
  Edit as EditIcon, 
  Save as SaveIcon, 
  Print as PrintIcon, 
  Restaurant as RestaurantIcon, 
  Timer as TimerIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  Person as PersonIcon
} from '@mui/icons-material';

// Local Imports
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';
import '../styles/print.css';
import RecipeSaveButton from '../components/RecipeSaveButton';
import RecipeSaveDialog from '../components/RecipeSaveDialog';
import MenuSharingModal from '../components/MenuSharingModal';

// Utility Functions
function formatIngredient(ing) {
  if (typeof ing === 'string') return ing;
  
  if (ing.name && ing.quantity) {
    return `${ing.quantity} ${ing.name}`;
  }

  if (ing.ingredient && ing.amount) {
    return `${ing.amount} ${ing.ingredient}`;
  }

  if (ing.item && ing.quantity) {
    return `${ing.quantity} ${ing.item}`;
  }

  return JSON.stringify(ing);
}

function getComplexityColor(level) {
  switch(level?.toLowerCase()) {
    case 'minimal': return 'success';
    case 'easy': return 'info';
    case 'standard': return 'warning';
    case 'complex': return 'error';
    default: return 'default';
  }
}

function getMealTimeLabel(mealTime) {
  return mealTime.charAt(0).toUpperCase() + mealTime.slice(1);
}

// Utility function to safely access nested properties
function safeGet(obj, path, defaultValue = '') {
  return path.split('.').reduce((acc, part) => 
    acc && acc[part] !== undefined ? acc[part] : defaultValue, obj);
}

function MenuDisplayPage() {
  const { user, updateUserProgress } = useAuth();
  const { organization, clients, isOwner } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // State management
  const [menu, setMenu] = useState(null);
  const [menuHistory, setMenuHistory] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printMode, setPrintMode] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [accessLevel, setAccessLevel] = useState('owner');

  // Filter States
  const [mealTimeFilters, setMealTimeFilters] = useState({
    breakfast: true,
    lunch: true,
    dinner: true,
    snacks: true
  });

  // Nickname editing states
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');

  // Check for new user flow from navigation state
  const { isNewUser, showWalkthrough } = location.state || {};

  const [printSections, setPrintSections] = useState({
    breakfast: true,
    lunch: true,
    dinner: true,
    snacks: true
  });

  const [durationDays, setDurationDays] = useState(7);

  // Initialize selectedClient from URL params if present
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && isOwner && clients.length > 0) {
      const client = clients.find(c => c.id === parseInt(clientId));
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [searchParams, clients, isOwner]);

  // Fetch saved recipes
  useEffect(() => {
    const fetchSavedRecipes = async () => {
      try {
        const saved = await apiService.getSavedRecipes();
        setSavedRecipes(saved);
      } catch (err) {
        console.error('Failed to fetch saved recipes', err);
      }
    };

    if (user) {
      fetchSavedRecipes();
    }
  }, [user]);

  // Fetch menu data
  const fetchMenuData = async () => {
    if (!user || !user.userId) {
      console.error('No user or userId found');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const history = await apiService.getMenuHistory(user.userId);
      setMenuHistory(history);

      if (history && history.length > 0) {
        const latestMenu = await apiService.getLatestMenu(user.userId);
        setMenu(latestMenu);
        setSelectedMenuId(latestMenu.menu_id);
        
        // Check access level
        if (latestMenu.access_level) {
          setAccessLevel(latestMenu.access_level);
        }
        
        // Check if shared menu and get creator info
        if (latestMenu.user_id !== user.userId) {
          try {
            const userData = await apiService.getUserProfile(latestMenu.user_id);
            setCreatorName(userData.name);
            setIsShared(true);
          } catch (err) {
            console.error('Error fetching creator details:', err);
          }
        }
        
        // Initialize selected days
        if (latestMenu.meal_plan?.days) {
          const initialSelectedDays = {};
          latestMenu.meal_plan.days.forEach(day => {
            initialSelectedDays[day.dayNumber] = true;
          });
          setSelectedDays(initialSelectedDays);
        }
      }
    } catch (err) {
      console.error('Menu fetch error:', err);
      
      if (err.response?.status === 404) {
        setError('No menus found. Generate your first menu!');
      } else if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError('Failed to load menus. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchMenuData();
  }, [user]);

  // Generate new menu
  const handleGenerateMenu = async () => {
    try {
      setLoading(true);
      setError('');

      if (durationDays < 1 || durationDays > 30) {
        setError('Please enter a number of days between 1 and 30');
        setLoading(false);
        return;
      }

      const preferences = await apiService.getUserPreferences(
        selectedClient ? selectedClient.id : user.userId
      );

      const menuRequest = {
        user_id: user.userId,
        client_id: selectedClient ? selectedClient.id : null,
        duration_days: durationDays,
        diet_type: preferences.diet_type || '',
        dietary_preferences: preferences.dietary_restrictions ? 
          preferences.dietary_restrictions.split(',').map(item => item.trim()) : [],
        disliked_foods: preferences.disliked_ingredients ? 
          preferences.disliked_ingredients.split(',').map(item => item.trim()) : [],
        meal_times: Object.keys(preferences.meal_times).filter(
          time => preferences.meal_times[time] && time !== 'snacks'
        ),
        snacks_per_day: preferences.meal_times.snacks ? preferences.snacks_per_day : 0,
        servings_per_meal: preferences.servings_per_meal || 2,
        calorie_goal: preferences.calorie_goal || 2000,
        macro_protein: preferences.macro_protein,
        macro_carbs: preferences.macro_carbs,
        macro_fat: preferences.macro_fat
      };

      const newMenu = await apiService.generateMenu(menuRequest);
      const updatedHistory = await apiService.getMenuHistory(user.userId);
      
      setMenuHistory(updatedHistory);
      setMenu(newMenu);
      setSelectedMenuId(newMenu.menu_id);

      updateUserProgress({ has_generated_menu: true });
      
      if (isNewUser) {
        navigate('/shopping-list', { 
          state: { 
            menuId: newMenu.menu_id,
            isNewUser: true,
            showWalkthrough: true 
          }
        });
      }
    } catch (err) {
      console.error('Menu generation error:', err);
      setError('Failed to generate menu. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle menu selection
  const handleMenuSelect = async (menuId) => {
    try {
      setLoading(true);
      setError('');
      
      // Reset shared menu status
      setIsShared(false);
      setCreatorName('');
      
      const menuDetails = await apiService.getMenuDetails(menuId);
      setMenu(menuDetails);
      setSelectedMenuId(menuId);
      
      // Check access level
      if (menuDetails.access_level) {
        setAccessLevel(menuDetails.access_level);
      } else {
        setAccessLevel('owner');
      }
      
      // Check if shared menu and get creator info
      if (menuDetails.user_id !== user.userId) {
        try {
          const userData = await apiService.getUserProfile(menuDetails.user_id);
          setCreatorName(userData.name);
          setIsShared(true);
        } catch (err) {
          console.error('Error fetching creator details:', err);
        }
      }

      if (menuDetails.meal_plan?.days) {
        const initialSelectedDays = {};
        menuDetails.meal_plan.days.forEach(day => {
          initialSelectedDays[day.dayNumber] = true;
        });
        setSelectedDays(initialSelectedDays);
      }
    } catch (err) {
      console.error('Error selecting menu:', err);
      setError('Failed to load selected menu');
    } finally {
      setLoading(false);
    }
  };

  // Nickname editing handlers
  const handleNicknameEdit = (menuId, currentNickname) => {
    setEditingNickname(menuId);
    setNicknameInput(currentNickname || '');
  };

  const handleUpdateNickname = async (menuId, nickname) => {
    try {
      setLoading(true);
      
      await apiService.updateMenuNickname(menuId, nickname);
      
      const history = await apiService.getMenuHistory(user.userId);
      setMenuHistory(history);
      
      if (selectedMenuId === menuId) {
        const updatedMenu = history.find(m => m.menu_id === menuId);
        if (updatedMenu) {
          setMenu(prevMenu => ({
            ...prevMenu,
            nickname: updatedMenu.nickname
          }));
        }
      }
      
      setEditingNickname(null);
      setNicknameInput('');
    } catch (err) {
      console.error('Error updating nickname:', err);
      setError('Failed to update nickname');
    } finally {
      setLoading(false);
    }
  };

  // Print handling
  const handlePrint = () => {
    setPrintMode(true);
    const allAccordions = document.querySelectorAll('.MuiAccordion-root');
    allAccordions.forEach(accordion => {
      accordion.style.display = 'block';
      const content = accordion.querySelector('.MuiCollapse-root');
      if (content) {
        content.style.display = 'block';
        content.style.height = 'auto';
      }
    });

    setTimeout(() => {
      window.print();
      setPrintMode(false);
      allAccordions.forEach(accordion => {
        accordion.style.removeProperty('display');
        const content = accordion.querySelector('.MuiCollapse-root');
        if (content) {
          content.style.removeProperty('display');
          content.style.removeProperty('height');
        }
      });
    }, 100);
  };

  const handlePrintDialogOpen = () => {
    setPrintDialogOpen(true);
  };

  const handlePrintDialogClose = () => {
    setPrintDialogOpen(false);
    if (menu?.meal_plan?.days) {
      const initialSelectedDays = {};
      menu.meal_plan.days.forEach(day => {
        initialSelectedDays[day.dayNumber] = true;
      });
      setSelectedDays(initialSelectedDays);
    }
    setPrintSections({
      breakfast: true,
      lunch: true,
      dinner: true,
      snacks: true
    });
  };

  const handleSelectAllDays = (event) => {
    const newSelectedDays = {};
    if (menu?.meal_plan?.days) {
      menu.meal_plan.days.forEach(day => {
        newSelectedDays[day.dayNumber] = event.target.checked;
      });
    }
    setSelectedDays(newSelectedDays);
  };

  const handleDaySelect = (dayNumber) => {
    setSelectedDays(prev => ({
      ...prev,
      [dayNumber]: !prev[dayNumber]
    }));
  };

  const renderMenuItems = () => {
    if (!menu?.meal_plan?.days) return null;

    const parsedMealPlan = typeof menu.meal_plan === 'string' 
      ? JSON.parse(menu.meal_plan) 
      : menu.meal_plan;

    return parsedMealPlan.days
      .filter(day => printMode ? selectedDays[day.dayNumber] : true)
      .map((day, dayIndex) => (
        <Accordion 
          key={dayIndex} 
          TransitionProps={{ unmountOnExit: false }}
          className={printMode ? 'print-expanded' : ''}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`day${day.dayNumber}-content`}
            id={`day${day.dayNumber}-header`}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="h6">Day {day.dayNumber}</Typography>
              {day.summary && (
                <Typography variant="body2" color="text.secondary">
                  Goal: {day.summary.calorie_goal} cal | 
                  P: {day.summary.protein_goal} | 
                  C: {day.summary.carbs_goal} | 
                  F: {day.summary.fat_goal} |
                  Servings Per Meal: {(day.meals && day.meals[0]?.servings) || 1} servings
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {day.meals && day.meals
              .filter(meal => {
                const mealType = meal.meal_time.toLowerCase();
                return mealTimeFilters[mealType];
              })
              .map((meal, mealIndex) => (
                <Accordion 
                  key={mealIndex} 
                  TransitionProps={{ unmountOnExit: false }}
                  sx={{ mb: 1, boxShadow: 'none', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`meal${mealIndex}-content`}
                    id={`meal${mealIndex}-header`}
                    sx={{ bgcolor: 'background.default', borderRadius: 1 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <Typography variant="subtitle1">
                        {meal.meal_time.charAt(0).toUpperCase() + meal.meal_time.slice(1)}: {meal.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {/* Save/Unsave Button */}                           
                        <RecipeSaveDialog
                          menuId={menu.menu_id}
                          dayNumber={day.dayNumber}
                          mealTime={meal.meal_time}
                          recipeTitle={meal.title}
                          isSaved={savedRecipes.some(
                            saved => saved.menu_id === menu.menu_id && 
                                     saved.meal_time === meal.meal_time &&
                                     saved.day_number === day.dayNumber
                          )}
                          savedId={savedRecipes.find(
                            saved => saved.menu_id === menu.menu_id && 
                                     saved.recipe_id === `${menu.menu_id}-${day.dayNumber}-${meal.meal_time}` && 
                                     saved.meal_time === meal.meal_time
                          )?.id}
                          onSaveSuccess={(result) => {
                            if (result.isSaved) {
                              // Add the new saved recipe to the state
                              setSavedRecipes(prev => [
                                ...prev,
                                {
                                  id: result.savedId,
                                  menu_id: result.menuId,
                                  recipe_id: result.recipeId,
                                  meal_time: result.mealTime,
                                  recipe_name: result.recipeTitle,
                                  day_number: day.dayNumber
                                }
                              ]);
                            } else {
                              // Remove the unsaved recipe from state
                              setSavedRecipes(prev => 
                                prev.filter(item => 
                                  !(item.menu_id === result.menuId && 
                                    item.recipe_id === result.recipeId && 
                                    item.meal_time === result.mealTime)
                                )
                              );
                            }
                          }}
                        />

                        {meal.appliance_used && (
                          <Chip
                            icon={<RestaurantIcon />}
                            label={meal.appliance_used}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {meal.complexity_level && (
                          <Chip
                            icon={<TimerIcon />}
                            label={meal.complexity_level}
                            size="small"
                            color={getComplexityColor(meal.complexity_level)}
                          />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Ingredients:</strong>
                      </Typography>
                      <ul style={{ margin: '8px 0' }}>
                        {meal.ingredients.map((ingredient, idx) => (
                          <li key={idx}>
                            <Typography variant="body2">
                              {formatIngredient(ingredient)}
                            </Typography>
                          </li>
                        ))}
                      </ul>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      <strong>Instructions:</strong>
                    </Typography>
                    {Array.isArray(meal.instructions) ? (
                      <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        {meal.instructions.map((step, idx) => {
                          // Remove any leading numbers and dots from the step
                          const cleanStep = step.replace(/^\d+\.\s*/, '');
                          return (
                            <li key={idx}>
                              <Typography variant="body2">{cleanStep}</Typography>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {meal.instructions}
                      </Typography>
                    )}
                      {meal.macros && (
                      <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Number of Servings:</strong> {meal.servings || 1}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            <strong>Per Serving:</strong><br />
                            Calories: {meal.macros.perServing.calories} |
                            Protein: {meal.macros.perServing.protein} |
                            Carbs: {meal.macros.perServing.carbs} |
                            Fat: {meal.macros.perServing.fat}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Total Recipe ({meal.servings || 1} servings):</strong><br />
                            Calories: {meal.macros.perMeal.calories} |
                            Protein: {meal.macros.perMeal.protein} |
                            Carbs: {meal.macros.perMeal.carbs} |
                            Fat: {meal.macros.perMeal.fat}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box> 
                  </AccordionDetails>
                </Accordion>
              ))}

            {/* Snacks Section */}
         {day.snacks && mealTimeFilters.snacks && (
           <Box sx={{ mt: 3 }}>
             <Typography variant="h6" sx={{ mb: 2 }}>Snacks</Typography>
             {day.snacks.map((snack, snackIndex) => (
               <Accordion 
                 key={snackIndex}
                 TransitionProps={{ unmountOnExit: false }}
                 sx={{ mb: 1 }}
               >
                 <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                     <Typography variant="subtitle1">
                       {safeGet(snack, 'title', 'Unnamed Snack')}
                     </Typography>
                     <Box sx={{ display: 'flex', gap: 1 }}>
                       {snack.appliance_used && (
                         <Chip
                           icon={<RestaurantIcon />}
                           label={snack.appliance_used}
                           size="small"
                           variant="outlined"
                         />
                       )}
                       {snack.complexity_level && (
                         <Chip
                           icon={<TimerIcon />}
                           label={snack.complexity_level}
                           size="small"
                           color={getComplexityColor(snack.complexity_level)}
                         />
                       )}
                     </Box>
                   </Box>
                 </AccordionSummary>
                 <AccordionDetails>
                   <Box sx={{ pl: 2 }}>
                     <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                       <strong>Ingredients:</strong>
                     </Typography>
                     <ul style={{ margin: '8px 0' }}>
                       {(snack.ingredients || []).map((ingredient, idx) => (
                         <li key={idx}>
                           <Typography variant="body2">
                             {formatIngredient(ingredient)}
                           </Typography>
                         </li>
                       ))}
                     </ul>               
                      {snack.macros && (
                       <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                         <Typography variant="body2" color="text.secondary">
                           <strong>Number of Servings:</strong> {snack.servings || 1}
                         </Typography>
                         <Box sx={{ mt: 1 }}>
                           <Typography variant="body2">
                             <strong>Per Serving:</strong><br />
                             Calories: {safeGet(snack.macros, 'perServing.calories', 'N/A')} |
                             Protein: {safeGet(snack.macros, 'perServing.protein', 'N/A')} |
                             Carbs: {safeGet(snack.macros, 'perServing.carbs', 'N/A')} |
                             Fat: {safeGet(snack.macros, 'perServing.fat', 'N/A')}
                           </Typography>
                           {safeGet(snack.macros, 'perMeal') && (
                             <Typography variant="body2" sx={{ mt: 1 }}>
                               <strong>Total Recipe ({snack.servings || 1} servings):</strong><br />
                               Calories: {safeGet(snack.macros, 'perMeal.calories', 'N/A')} |
                               Protein: {safeGet(snack.macros, 'perMeal.protein', 'N/A')} |
                               Carbs: {safeGet(snack.macros, 'perMeal.carbs', 'N/A')} |
                               Fat: {safeGet(snack.macros, 'perMeal.fat', 'N/A')}
                             </Typography>
                           )}
                         </Box>
                       </Box>
                     )}
                   </Box>
                 </AccordionDetails>
               </Accordion>
             ))}
           </Box>
         )}
          </AccordionDetails>
        </Accordion>
      ));
  };
  
  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Your Meal Plan
      </Typography>

      {/* Show shared menu attribution */}
      {isShared && creatorName && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This menu was created by {creatorName} and shared with you. 
          {accessLevel === 'read' ? 
            ' You have read-only access.' : 
            ' You can comment on this menu.'}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            View Meal Times
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.breakfast}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    breakfast: e.target.checked
                  }))}
                />
              }
              label="Breakfast"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.lunch}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    lunch: e.target.checked
                  }))}
                />
              }
              label="Lunch"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.dinner}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    dinner: e.target.checked
                  }))}
                />
              }
              label="Dinner"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.snacks}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    snacks: e.target.checked
                  }))}
                />
              }
              label="Snacks"
            />
          </Box>
        </Paper>
      </Box>

      {/* Client Selection for Organization Owners */}
      {isOwner && organization && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Create Menu For
          </Typography>
          <RadioGroup 
            row 
            value={selectedClient ? selectedClient.id : ''}
            onChange={(e) => {
              const clientId = e.target.value;
              if (clientId === '') {
                setSelectedClient(null);
              } else {
                const client = clients.find(c => c.id === parseInt(clientId));
                if (client) {
                  setSelectedClient(client);
                }
              }
            }}
          >
            <FormControlLabel
              value=""
              control={<Radio />}
              label="Myself"
            />
            {clients.map(client => (
              <FormControlLabel
                key={client.id}
                value={client.id.toString()}
                control={<Radio />}
                label={client.name}
              />
            ))}
          </RadioGroup>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        {menuHistory.length > 0 && (
          <FormControl fullWidth>
            <InputLabel>Select Previous Menu</InputLabel>
            <Select
              value={selectedMenuId || ''}
              label="Select Previous Menu"
              onChange={(e) => handleMenuSelect(e.target.value)}
            >
              {menuHistory.map((menuItem) => (
                <MenuItem 
                  key={menuItem.menu_id} 
                  value={menuItem.menu_id}
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {editingNickname === menuItem.menu_id ? (
                      <>
                        <TextField
                          size="small"
                          value={nicknameInput}
                          onChange={(e) => setNicknameInput(e.target.value)}
                          placeholder="Enter nickname"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ mr: 1, flexGrow: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateNickname(menuItem.menu_id, nicknameInput);
                          }}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <Typography sx={{ flexGrow: 1 }}>
                          {menuItem.nickname || `Menu from ${new Date(menuItem.created_at).toLocaleDateString()}`}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNicknameEdit(menuItem.menu_id, menuItem.nickname);
                          }}
                          sx={{ ml: 1 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Number of Days"
            type="number"
            value={durationDays}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setDurationDays(isNaN(value) ? 7 : value);
            }}
            inputProps={{
              min: 1,
              max: 30
            }}
            sx={{ flexGrow: 1 }}
          />

          <Button 
            variant="contained" 
            color="primary"
            onClick={handleGenerateMenu}
            disabled={loading}
            sx={{ flex: 1 }}
          >
            Generate New Menu
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintDialogOpen}
            disabled={!menu}
            sx={{ flex: 1 }}
          >
            Print Menu
          </Button>
        </Box>
      </Box>

 {/* Print Dialog */}
      <Dialog open={printDialogOpen} onClose={handlePrintDialogClose}>
        <DialogTitle>Print Menu Options</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1">Select Days to Print</Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Object.values(selectedDays).every(Boolean)}
                  indeterminate={
                    Object.values(selectedDays).some(Boolean) &&
                    !Object.values(selectedDays).every(Boolean)
                  }
                  onChange={handleSelectAllDays}
                />
              }
              label="Select All Days"
            />
            <Grid container spacing={2}>
              {menu?.meal_plan?.days?.map((day) => (
                <Grid item xs={6} key={day.dayNumber}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedDays[day.dayNumber] || false}
                        onChange={() => handleDaySelect(day.dayNumber)}
                      />
                    }
                    label={`Day ${day.dayNumber}`}
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePrintDialogClose}>Cancel</Button>
          <Button 
            onClick={() => {
              handlePrintDialogClose();
              handlePrint();
            }} 
            variant="contained"
            disabled={!Object.values(selectedDays).some(Boolean)}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {menu && renderMenuItems()}

      {/* Snackbar for save/unsave messages */}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
}

export default MenuDisplayPage;