// src/pages/MenuDisplayPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

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
  Person as PersonIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';

// Local Imports
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import '../styles/print.css';
import RecipeSaveButton from '../components/RecipeSaveButton';
import RecipeSaveDialog from '../components/RecipeSaveDialog';
import MenuSharingModal from '../components/MenuSharingModal';
import ModelSelectionDialog from '../components/ModelSelectionDialog';
import MenuGenerationProgress from '../components/MenuGenerationProgress';
import RateRecipeButton from '../components/RateRecipeButton';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { menuId: paramMenuId } = useParams();
  const [searchParams] = useSearchParams();

  // Client mode state
  const [clientMode, setClientMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // State management
  const [menu, setMenu] = useState(null);
  const [menuHistory, setMenuHistory] = useState([]);
  const queryMenuId = searchParams.get('menuId');
  const [selectedMenuId, setSelectedMenuId] = useState(queryMenuId || paramMenuId || null);
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
  const [accessLevel, setAccessLevel] = useState('owner');
  
  // Model selection dialog state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('default');

  // Menu generation progress state
  const [generationProgress, setGenerationProgress] = useState(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);

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

  // Check for client ID in URL params
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    console.log('Client ID from URL:', clientId);
    console.log('Menu ID from URL:', queryMenuId);
    
    if (clientId) {
      setClientMode(true);
      // Fetch client data if in client mode
      apiService.getClientDetails(clientId)
        .then(client => {
          console.log('Client details fetched:', client);
          setSelectedClient(client);
          
          // If a specific menuId is provided, try to load it
          if (queryMenuId) {
            console.log('Using menu ID from query params:', queryMenuId);
            setSelectedMenuId(queryMenuId);
          } 
          // Otherwise get the client's latest menu
          else if (!selectedMenuId) {
            console.log('Fetching client menus since no menuId provided');
            apiService.getClientMenus(clientId)
              .then(menus => {
                console.log('Client menus retrieved:', menus);
                if (menus && menus.length > 0) {
                  const latestMenu = menus[0];
                  console.log('Setting latest menu:', latestMenu.menu_id);
                  setMenu(latestMenu);
                  setSelectedMenuId(latestMenu.menu_id);
                }
              })
              .catch(err => console.error('Error fetching client menus:', err));
          }
        })
        .catch(err => console.error('Error fetching client details:', err));
    }
  }, [searchParams, selectedMenuId, queryMenuId]);

  // Check if share mode is active
  useEffect(() => {
    const shareMode = searchParams.get('share') === 'true';
    if (shareMode && selectedMenuId) {
      setSharingModalOpen(true);
    }
  }, [searchParams, selectedMenuId]);

  // Check for new user flow from navigation state
  const { isNewUser, showWalkthrough } = location.state || {};

  const [printSections, setPrintSections] = useState({
    breakfast: true,
    lunch: true,
    dinner: true,
    snacks: true
  });

  const [durationDays, setDurationDays] = useState(7);

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

      // Check for active jobs or recently completed background jobs
      if (!selectedMenuId && !searchParams.get('source')) {
        try {
          const jobCheck = await apiService.checkForPendingMenuJobs(user.userId);

          if (jobCheck.hasActiveJob) {
            // There's an active job running
            const activeJob = jobCheck.activeJobs[0]; // Get the most recent
            const timeRunning = Math.round(activeJob.time_running / 60); // minutes

            setActiveJobId(activeJob.job_id);
            setSnackbarMessage(`🔄 Your meal plan is still generating (${timeRunning} minutes so far). Click here to watch progress!`);
            setSnackbarOpen(true);

            console.log('Found active job:', activeJob.job_id);

          } else if (jobCheck.hasRecentMenu) {
            // Found a recently completed menu
            setSnackbarMessage(`🎉 Great news! Your meal plan finished generating ${jobCheck.timeAgo} minute(s) ago and is ready!`);
            setSnackbarOpen(true);
          }
        } catch (err) {
          console.warn('Could not check for pending jobs:', err);
        }
      }

      // Check if this is a client-sourced menu
      const isClientSourced = searchParams.get('source') === 'client';
      console.log(`Is client-sourced menu: ${isClientSourced}`, searchParams.toString());

      // Fetch menu history (skip for client-sourced menu)
      if (!isClientSourced) {
        const history = await apiService.getMenuHistory(user.userId);
        setMenuHistory(history);
      }

      // If we have a specific menu ID, fetch that menu
      if (selectedMenuId) {
        console.log(`Fetching menu with ID: ${selectedMenuId}`);
        
        let menuDetails;
        try {
          // Try to fetch as client menu first if this is a client-sourced menu
          if (isClientSourced) {
            console.log("Trying to fetch as client menu");
            menuDetails = await apiService.getClientMenu(selectedMenuId);
          } else {
            menuDetails = await apiService.getMenuDetails(selectedMenuId);
          }
          
          console.log("Menu details fetched:", menuDetails);
          setMenu(menuDetails);
          
          // Initialize selected days
          if (menuDetails.meal_plan?.days) {
            const initialSelectedDays = {};
            menuDetails.meal_plan.days.forEach(day => {
              initialSelectedDays[day.dayNumber] = true;
            });
            setSelectedDays(initialSelectedDays);
          }
        } catch (menuErr) {
          console.error("Error fetching menu details:", menuErr);

          // Try alternate endpoints as fallback
          try {
            if (isClientSourced) {
              // If client-sourced, try regular menu endpoint first
              try {
                menuDetails = await apiService.getMenuDetails(selectedMenuId);
                console.log("Menu details fetched from regular endpoint:", menuDetails);
              } catch (regularErr) {
                // Try custom menu endpoint as second fallback
                menuDetails = await apiService.getCustomMenuDetails(selectedMenuId);
                console.log("Menu details fetched from custom menu endpoint:", menuDetails);
              }
            } else {
              // Try client menu endpoint first, then custom menu endpoint
              try {
                menuDetails = await apiService.getClientMenu(selectedMenuId);
                console.log("Menu details fetched from client endpoint:", menuDetails);
              } catch (clientErr) {
                // Try custom menu endpoint as second fallback
                menuDetails = await apiService.getCustomMenuDetails(selectedMenuId);
                console.log("Menu details fetched from custom menu endpoint:", menuDetails);
              }
            }

            setMenu(menuDetails);

            // Initialize selected days
            if (menuDetails.meal_plan?.days) {
              const initialSelectedDays = {};
              menuDetails.meal_plan.days.forEach(day => {
                initialSelectedDays[day.dayNumber] = true;
              });
              setSelectedDays(initialSelectedDays);
            }
          } catch (fallbackErr) {
            console.error("All fallback menu fetch attempts failed:", fallbackErr);
            throw menuErr; // Re-throw original error for handling
          }
        }
      } 
      // Otherwise fetch the latest menu (not for client-sourced menus)
      else if (!isClientSourced && menuHistory && menuHistory.length > 0) {
        const latestMenu = await apiService.getLatestMenu(user.userId);
        setMenu(latestMenu);
        setSelectedMenuId(latestMenu.menu_id);
        
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
      } else if (err.response?.status === 422) {
        setError('Menu format error. Please try a different menu.');
      } else {
        setError('Failed to load menus. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch - also respond to changes in URL query parameters
  useEffect(() => {
    // If the queryMenuId changes in the URL, update the selectedMenuId
    if (queryMenuId && queryMenuId !== selectedMenuId) {
      setSelectedMenuId(queryMenuId);
    } else {
      fetchMenuData();
    }
  }, [user, selectedMenuId, queryMenuId]);

  // Handler for model selection
  const handleOpenModelDialog = () => {
    setModelDialogOpen(true);
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    continueGenerateMenu();
  };

  // Generate new menu - split into two parts
  const handleGenerateMenu = async () => {
    try {
      if (durationDays < 1 || durationDays > 7) {
        setError('Please enter a number of days between 1 and 7');
        return;
      }

      // Open model selection dialog first
      setModelDialogOpen(true);
    } catch (err) {
      console.error('Error in menu generation setup:', err);
      setError('Failed to setup menu generation. Please try again.');
    }
  };

  // Continue with menu generation after model selection
  const continueGenerateMenu = async () => {
    try {
      setLoading(true);
      setError('');

      // Determine whose preferences to use
      const targetUserId = selectedClient ? selectedClient.id : user.userId;

      const preferences = await apiService.getUserPreferences(targetUserId);

      const menuRequest = {
        user_id: user.userId, // Current user (trainer) is the creator
        client_id: selectedClient ? selectedClient.id : null, // Client ID if applicable
        duration_days: durationDays,
        diet_type: preferences.diet_type || '',
        dietary_preferences: preferences.dietary_restrictions ? 
          preferences.dietary_restrictions.split(',').map(item => item.trim()) : [],
        disliked_foods: preferences.disliked_ingredients ? 
          preferences.disliked_ingredients.split(',').map(item => item.trim()) : [],
        meal_times: Object.keys(preferences.meal_times || {}).filter(
          time => preferences.meal_times[time] && time !== 'snacks'
        ),
        snacks_per_day: preferences.meal_times?.snacks ? preferences.snacks_per_day : 0,
        servings_per_meal: preferences.servings_per_meal || 2,
        calorie_goal: preferences.calorie_goal || 2000,
        macro_protein: preferences.macro_protein,
        macro_carbs: preferences.macro_carbs,
        macro_fat: preferences.macro_fat,
        // Add model selection information
        ai_model: selectedModel
      };

      console.log(`Generating menu with model: ${selectedModel}, days: ${durationDays}`);

      // Show progress dialog
      setShowProgressDialog(true);
      setGenerationProgress({
        phase: 'initializing',
        message: 'Starting meal plan generation...',
        progress: 0
      });

      const newMenu = await apiService.generateMenuWithBackgroundJob(menuRequest, (progress) => {
        setGenerationProgress(progress);

        // Auto-close dialog on completion
        if (progress.phase === 'complete') {
          setTimeout(() => {
            setShowProgressDialog(false);
            setGenerationProgress(null);
          }, 2000);
        }
      });

      console.log('Menu generation successful');
      
      const updatedHistory = await apiService.getMenuHistory(user.userId);
      
      setMenuHistory(updatedHistory);
      setMenu(newMenu);
      setSelectedMenuId(newMenu.menu_id);

      updateUserProgress({ has_generated_menu: true });

      // If in client mode, navigate to show the generated menu with client context
      if (clientMode && selectedClient) {
        navigate(`/menu/${newMenu.menu_id}?clientId=${selectedClient.id}`, { replace: true });
      }
      
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

      // Update progress to show we're checking for results
      setGenerationProgress({
        phase: 'error',
        message: 'Connection issue detected. Checking if menu was generated...',
        progress: 90,
        error: err.message
      });

      // Always try to recover - check for any newly generated menu
      let recoverySuccessful = false;

      try {
        console.log("Attempting recovery - checking for latest menu...");

        // Wait a moment for any background processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        const latestMenu = await apiService.getLatestMenu(user.userId);

        // Check if we have a valid menu that's newer than our current one
        if (latestMenu && latestMenu.menu_id &&
            (!selectedMenuId || latestMenu.menu_id !== selectedMenuId)) {

          console.log("Recovery successful - found new menu:", latestMenu.menu_id);

          // Update state with the recovered menu
          setMenu(latestMenu);
          setSelectedMenuId(latestMenu.menu_id);

          // Fetch updated history
          const updatedHistory = await apiService.getMenuHistory(user.userId);
          setMenuHistory(updatedHistory);

          updateUserProgress({ has_generated_menu: true });

          // Update progress to show success
          setGenerationProgress({
            phase: 'complete',
            message: 'Menu generated successfully despite connection issue!',
            progress: 100
          });

          // Auto-close dialog after showing success
          setTimeout(() => {
            setShowProgressDialog(false);
            setGenerationProgress(null);
          }, 3000);

          // Show success message
          setError('');
          setSnackbarMessage('Menu generated successfully! There was a minor connection issue but your menu is ready.');
          setSnackbarOpen(true);

          recoverySuccessful = true;

          // If in client mode, navigate appropriately
          if (clientMode && selectedClient) {
            navigate(`/menu/${latestMenu.menu_id}?clientId=${selectedClient.id}`, { replace: true });
          }

          if (isNewUser) {
            navigate('/shopping-list', {
              state: {
                menuId: latestMenu.menu_id,
                isNewUser: true,
                showWalkthrough: true
              }
            });
          }
        }
      } catch (recoveryErr) {
        console.error("Recovery attempt failed:", recoveryErr);
      }

      // Only show error if recovery was not successful
      if (!recoverySuccessful) {
        // Update progress to show final error state
        setGenerationProgress({
          phase: 'error',
          message: 'Menu generation failed. Please try again.',
          progress: 0,
          error: err.message
        });

        // Display user-friendly error message
        if (err.response?.status === 500) {
          setError('Server error occurred during menu generation. Please try again with fewer days or a different AI model.');
        } else if (err.message && err.message.includes('timed out')) {
          setError('Menu generation timed out. Try reducing the number of days or using a different AI model.');
        } else if (err.response?.status === 504) {
          setError('The server took too long to respond. Try generating a shorter menu or try again later.');
        } else {
          setError(`Failed to generate menu: ${err.message || 'Please try again.'}`);
        }

        // Auto-close progress dialog after 5 seconds on error
        setTimeout(() => {
          setShowProgressDialog(false);
          setGenerationProgress(null);
        }, 5000);
      }
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

  // Open sharing modal
  const handleOpenSharingModal = () => {
    setSharingModalOpen(true);
  };

  // Add to cart handler
  const handleAddToCart = async () => {
    if (!menu || !menu.menu_id) {
      setError('No menu selected');
      return;
    }

    try {
      // Redirect to shopping list with this menu
      navigate(`/shopping-list?menuId=${menu.menu_id}${selectedClient ? `&clientId=${selectedClient.id}` : ''}`);
    } catch (err) {
      console.error('Error navigating to shopping list:', err);
      setError('Failed to process shopping list');
    }
  };

  // Resume watching active job
  const handleResumeJobWatching = async () => {
    if (!activeJobId) return;

    setSnackbarOpen(false);
    setShowProgressDialog(true);

    try {
      // Create a polling mechanism to watch the job
      const pollInterval = setInterval(async () => {
        try {
          const statusResp = await apiService.axiosInstance.get(`/menu/job-status/${activeJobId}`, {
            timeout: 10000
          });

          const status = statusResp.data;

          setGenerationProgress({
            phase: status.status,
            message: status.message,
            progress: status.progress
          });

          if (status.status === 'completed') {
            clearInterval(pollInterval);

            setGenerationProgress({
              phase: 'complete',
              message: 'Menu generated successfully!',
              progress: 100
            });

            setTimeout(() => {
              setShowProgressDialog(false);
              setGenerationProgress(null);
              setActiveJobId(null);
              // Refresh the page to load the new menu
              fetchMenuData();
            }, 2000);

          } else if (status.status === 'failed') {
            clearInterval(pollInterval);

            setGenerationProgress({
              phase: 'error',
              message: 'Generation failed',
              progress: 0,
              error: status.error
            });

            setActiveJobId(null);
          }

        } catch (pollError) {
          console.warn('Status check failed, continuing...', pollError);
        }
      }, 3000);

      // Safety timeout
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 1200000); // 20 minutes

    } catch (err) {
      console.error('Failed to resume job watching:', err);
      setShowProgressDialog(false);
    }
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
          sx={{
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
            mb: { xs: 2, sm: 2 },
            '& .MuiAccordionSummary-root': {
              minHeight: { xs: '64px', sm: 'auto' },
              padding: { xs: '0 16px', sm: 'auto' }
            },
            '& .MuiAccordionSummary-content': {
              margin: { xs: '12px 0', sm: '12px 0' }
            },
            '& .MuiAccordionDetails-root': {
              padding: { xs: '8px 8px', sm: '16px 16px' }
            }
          }}
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
                  sx={{ 
                    mb: 1, 
                    width: '100%',
                    boxShadow: 'none', 
                    '&:before': { display: 'none' },
                    '& .MuiAccordionSummary-root': {
                      minHeight: { xs: '60px', sm: 'auto' },
                      padding: { xs: '0 8px', sm: '0 16px' },
                      width: '100%'
                    },
                    '& .MuiAccordionSummary-content': {
                      margin: { xs: '12px 0', sm: '12px 0' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      width: '100%'
                    },
                    '& .MuiAccordionDetails-root': {
                      padding: { xs: '8px 8px', sm: '16px 16px' },
                      width: '100%'
                    }
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`meal${mealIndex}-content`}
                    id={`meal${mealIndex}-header`}
                    sx={{ bgcolor: 'background.default', borderRadius: 1 }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between', 
                      width: '100%', 
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: { xs: 1, sm: 0 }
                    }}>
                      <Typography 
                        variant="subtitle1"
                        sx={{ 
                          fontSize: { xs: '1rem', sm: 'inherit' },
                          fontWeight: { xs: 'bold', sm: 'inherit' }
                        }}
                      >
                        {meal.meal_time.charAt(0).toUpperCase() + meal.meal_time.slice(1)}: {meal.title}
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        gap: { xs: 2, sm: 1 }, 
                        alignItems: 'center',
                        width: { xs: '100%', sm: 'auto' },
                        justifyContent: { xs: 'flex-start', sm: 'flex-end' }
                      }}>
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

                        {/* Rate Recipe Button */}
                        <RateRecipeButton
                          recipeId={`${menu.menu_id}-${day.dayNumber}-${meal.meal_time}`}
                          recipeTitle={meal.title}
                          variant="icon"
                          size="small"
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
                    <Box sx={{ 
                      pl: { xs: 0, sm: 2 }, 
                      mt: { xs: 2, sm: 0 },
                      width: '100%',
                      overflowX: 'hidden'
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Ingredients:</strong>
                      </Typography>
                      <ul style={{ 
                        margin: '8px 0',
                        paddingLeft: '20px',
                        boxSizing: 'border-box'
                      }}>
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
                      <ol style={{ 
                        margin: '8px 0', 
                        paddingLeft: '20px',
                        wordBreak: 'break-word'
                      }}>
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
                      <Box sx={{ 
                        mt: 2, 
                        p: 1, 
                        bgcolor: 'background.default', 
                        borderRadius: 1,
                        width: '100%',
                        boxSizing: 'border-box',
                        overflowX: 'hidden',
                        wordBreak: 'break-word'
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Number of Servings:</strong> {meal.servings || 1}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            <strong>Per Serving:</strong><br />
                            Calories: {safeGet(meal.macros, 'perServing.calories', 'N/A')} |
                            Protein: {safeGet(meal.macros, 'perServing.protein', 'N/A')} |
                            Carbs: {safeGet(meal.macros, 'perServing.carbs', 'N/A')} |
                            Fat: {safeGet(meal.macros, 'perServing.fat', 'N/A')}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Total Recipe ({meal.servings || 1} servings):</strong><br />
                            Calories: {safeGet(meal.macros, 'perMeal.calories', 'N/A')} |
                            Protein: {safeGet(meal.macros, 'perMeal.protein', 'N/A')} |
                            Carbs: {safeGet(meal.macros, 'perMeal.carbs', 'N/A')} |
                            Fat: {safeGet(meal.macros, 'perMeal.fat', 'N/A')}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box> 
                  </AccordionDetails>
                </Accordion>
              ))}

            {/* Snacks Section */}
            {day.snacks && mealTimeFilters.snacks && day.snacks.length > 0 && (
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
                      <Box sx={{ pl: { xs: 0, sm: 2 }, mt: { xs: 2, sm: 0 } }}>
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

                        {/* Add instructions section for snacks */}
                        {snack.instructions && snack.instructions.length > 0 && (
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                              <strong>Instructions:</strong>
                            </Typography>
                            {Array.isArray(snack.instructions) ? (
                              <ol style={{
                                margin: '8px 0',
                                paddingLeft: '20px',
                                wordBreak: 'break-word'
                              }}>
                                {snack.instructions.map((step, idx) => {
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
                                {snack.instructions}
                              </Typography>
                            )}
                          </>
                        )}

                        {snack.macros && (
                          <Box sx={{ 
                        mt: 2, 
                        p: 1, 
                        bgcolor: 'background.default', 
                        borderRadius: 1,
                        width: '100%',
                        boxSizing: 'border-box',
                        overflowX: 'hidden',
                        wordBreak: 'break-word'
                      }}>
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
    <Container 
      maxWidth="xl"
      disableGutters={true}
      sx={{
        px: { xs: 0, sm: 2, md: 3 },
        width: '100%',
        maxWidth: '100%' 
      }}
    >
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{
          px: { xs: 2, sm: 0 },
          fontSize: { xs: '1.75rem', sm: '2.125rem' }
        }}
      >
        {clientMode && selectedClient ? `${selectedClient.name}'s Meal Plan` : 'Your Meal Plan'}
      </Typography>

      {/* Show shared menu attribution */}
      {isShared && creatorName && (
        <Alert severity="info" sx={{ mb: 2, mx: { xs: 2, sm: 0 } }}>
          This menu was created by {creatorName} and shared with you. 
          {accessLevel === 'read' ? 
            ' You have read-only access.' : 
            ' You can comment on this menu.'}
        </Alert>
      )}

      {/* Show client mode info */}
      {clientMode && selectedClient && (
        <Alert severity="info" sx={{ mb: 2, mx: { xs: 2, sm: 0 } }}>
          Viewing meal plan for client: <strong>{selectedClient.name}</strong>
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

      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column', 
        gap: 2, 
        mb: 2, 
        mx: { xs: 2, sm: 0 } 
      }}>
        <Paper sx={{ 
          p: { xs: 2, sm: 2 },
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <Typography variant="subtitle1" gutterBottom>
            View Meal Times
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1 
          }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.breakfast}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    breakfast: e.target.checked
                  }))}
                  sx={{ 
                    padding: { xs: '9px', sm: '9px' },
                    '& .MuiSvgIcon-root': { fontSize: { xs: 24, sm: 'default' }}
                  }}
                />
              }
              label="Breakfast"
              sx={{ 
                marginLeft: 0,
                width: { xs: '100%', sm: 'auto' },
                borderRadius: { xs: 1, sm: 0 },
                padding: { xs: '4px 8px', sm: 0 },
                '&:hover': { bgcolor: { xs: 'rgba(0,0,0,0.04)', sm: 'transparent' }}
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.lunch}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    lunch: e.target.checked
                  }))}
                  sx={{ 
                    padding: { xs: '9px', sm: '9px' },
                    '& .MuiSvgIcon-root': { fontSize: { xs: 24, sm: 'default' }}
                  }}
                />
              }
              label="Lunch"
              sx={{ 
                marginLeft: 0,
                width: { xs: '100%', sm: 'auto' },
                borderRadius: { xs: 1, sm: 0 },
                padding: { xs: '4px 8px', sm: 0 },
                '&:hover': { bgcolor: { xs: 'rgba(0,0,0,0.04)', sm: 'transparent' }}
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.dinner}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    dinner: e.target.checked
                  }))}
                  sx={{ 
                    padding: { xs: '9px', sm: '9px' },
                    '& .MuiSvgIcon-root': { fontSize: { xs: 24, sm: 'default' }}
                  }}
                />
              }
              label="Dinner"
              sx={{ 
                marginLeft: 0,
                width: { xs: '100%', sm: 'auto' },
                borderRadius: { xs: 1, sm: 0 },
                padding: { xs: '4px 8px', sm: 0 },
                '&:hover': { bgcolor: { xs: 'rgba(0,0,0,0.04)', sm: 'transparent' }}
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={mealTimeFilters.snacks}
                  onChange={(e) => setMealTimeFilters(prev => ({
                    ...prev,
                    snacks: e.target.checked
                  }))}
                  sx={{ 
                    padding: { xs: '9px', sm: '9px' },
                    '& .MuiSvgIcon-root': { fontSize: { xs: 24, sm: 'default' }}
                  }}
                />
              }
              label="Snacks"
              sx={{ 
                marginLeft: 0,
                width: { xs: '100%', sm: 'auto' },
                borderRadius: { xs: 1, sm: 0 },
                padding: { xs: '4px 8px', sm: 0 },
                '&:hover': { bgcolor: { xs: 'rgba(0,0,0,0.04)', sm: 'transparent' }}
              }}
            />
          </Box>
        </Paper>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2, 
        mb: 2,
        mx: { xs: 2, sm: 0 }
      }}>
        {menuHistory.length > 0 && (
          <FormControl 
            fullWidth
            sx={{
              width: '100%',
              boxSizing: 'border-box'
            }}>
            <InputLabel>Select Previous Menu</InputLabel>
            <Select
              value={selectedMenuId || ''}
              label="Select Previous Menu"
              onChange={(e) => handleMenuSelect(e.target.value)}
              sx={{
                '& .MuiInputBase-root': {
                  height: { xs: '56px', sm: 'auto' },
                }
              }}
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

        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2, 
          mb: 2 
        }}>
          <TextField
            label="Number of Days"
            type="number"
            value={durationDays}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setDurationDays(isNaN(value) ? 7 : Math.min(7, Math.max(1, value)));
            }}
            inputProps={{
              min: 1,
              max: 7
            }}
            sx={{ 
              flexGrow: 1,
              '& .MuiInputBase-root': {
                height: { xs: '56px', sm: 'auto' },
              }
            }}
          />

          {/* Show button for accounts that are not 'free' or 'client' */}
          {(!user?.account_type || (user.account_type !== 'free' && user.account_type !== 'client')) ? (
            <Button
              variant="contained"
              color="primary"
              onClick={handleGenerateMenu}
              disabled={loading}
              sx={{
                flex: { xs: '1 1 100%', sm: 1 },
                height: { xs: '48px', sm: 'auto' },
                fontSize: { xs: '1rem', sm: 'inherit' },
                mb: { xs: 1, sm: 0 }
              }}
            >
              {clientMode && selectedClient
                ? `Generate Menu for ${selectedClient.name}`
                : 'Generate New Menu'}
            </Button>
          ) : (
            <Box
              sx={{
                flex: { xs: '1 1 100%', sm: 1 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                mb: { xs: 1, sm: 0 }
              }}
            >
              <Typography variant="body2" align="center" color="text.secondary">
                {user.account_type === 'client'
                  ? "Menu generation is handled by your organization"
                  : "Upgrade your subscription to generate new meal plans"}
              </Typography>
              {user.account_type !== 'client' && (
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => navigate('/subscription')}
                >
                  View Plans
                </Button>
              )}
            </Box>
          )}

          {menu && (
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintDialogOpen}
                disabled={!menu}
                sx={{ 
                  flex: { xs: '1 1 100%', sm: 1 },
                  height: { xs: '48px', sm: 'auto' },
                  fontSize: { xs: '1rem', sm: 'inherit' },
                  mb: { xs: 1, sm: 0 }
                }}
              >
                Print Menu
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                startIcon={<ShoppingCartIcon />}
                onClick={handleAddToCart}
                disabled={!menu}
                sx={{ 
                  flex: { xs: '1 1 100%', sm: 1 },
                  height: { xs: '48px', sm: 'auto' },
                  fontSize: { xs: '1rem', sm: 'inherit' },
                  mb: { xs: 1, sm: 0 }
                }}
              >
                Shopping List
              </Button>

              {!clientMode && (
                <Button
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={handleOpenSharingModal}
                  disabled={!menu}
                  sx={{ 
                    flex: { xs: '1 1 100%', sm: 1 },
                    height: { xs: '48px', sm: 'auto' },
                    fontSize: { xs: '1rem', sm: 'inherit' }
                  }}
                >
                  Share
                </Button>
              )}
            </>
          )}
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

      {/* Menu Sharing Modal */}
      <MenuSharingModal
        open={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        menuId={selectedMenuId}
        menuTitle={menu?.nickname || (menu ? `Menu from ${new Date(menu.created_at).toLocaleDateString()}` : '')}
      />
      
      {/* AI Model Selection Dialog */}
      <ModelSelectionDialog
        open={modelDialogOpen}
        onClose={() => setModelDialogOpen(false)}
        onModelSelect={handleModelSelect}
      />

      {menu && (
        <Box sx={{ 
          width: '100%',
          px: { xs: 1, sm: 0 },
          '& .MuiAccordion-root': {
            width: '100%'
          }
        }}>
          {renderMenuItems()}
        </Box>
      )}

      {/* Snackbar for save/unsave messages */}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        open={snackbarOpen}
        autoHideDuration={activeJobId ? 8000 : 3000}
        onClose={() => {
          setSnackbarOpen(false);
          setActiveJobId(null);
        }}
        message={snackbarMessage}
        onClick={activeJobId ? handleResumeJobWatching : undefined}
        sx={{
          cursor: activeJobId ? 'pointer' : 'default',
          '& .MuiSnackbarContent-root': {
            backgroundColor: activeJobId ? '#1976d2' : undefined,
            '&:hover': {
              backgroundColor: activeJobId ? '#115293' : undefined
            }
          }
        }}
      />

      {/* Progress Dialog for Menu Generation */}
      <MenuGenerationProgress
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        progress={generationProgress}
        allowClose={generationProgress?.phase === 'error' || generationProgress?.phase === 'generating' || generationProgress?.phase === 'started'}
      />
    </Container>
  );
}

export default MenuDisplayPage;