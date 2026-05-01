import React, { useState, useEffect, useCallback } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

// Custom styles for better visibility with opaque background
const joyrideStyles = {
  options: {
    primaryColor: '#1976d2',
    backgroundColor: '#ffffff',
    overlayColor: 'rgba(0, 0, 0, 0.7)', // More opaque overlay
    spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
    width: 420,
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#ffffff', // Ensure white background
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)', // Strong shadow for contrast
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  tooltipContent: {
    padding: '20px',
    color: '#333333', // Dark text for readability
  },
  buttonNext: {
    backgroundColor: '#1976d2',
    fontSize: 16,
    padding: '12px 20px',
    borderRadius: 6,
    fontWeight: 'bold',
  },
  buttonBack: {
    color: '#666',
    fontSize: 16,
    padding: '12px 20px',
  },
  buttonSkip: {
    color: '#666',
    fontSize: 14,
  },
  beacon: {
    display: 'none', // Hide beacons for cleaner look
  },
};

// Comprehensive walkthrough steps including recipe browser
const WALKTHROUGH_STEPS = {
  preferences: [
    {
      target: 'body',
      content: (
        <div>
          <h3>Welcome to Smart Meal Planner! 🎉</h3>
          <p>Let's take a quick tour to help you get started. We'll show you how to:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>Set up your dietary preferences</li>
            <li>Generate personalized meal plans</li>
            <li>Browse and save recipes</li>
            <li>Create shopping lists</li>
          </ul>
          <p style={{ marginTop: '15px' }}>This should only take about 3-4 minutes!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-testid="diet-types-section"]',
      content: (
        <div>
          <h4>Choose Your Diet Types</h4>
          <p>Select any dietary preferences you follow. You can choose multiple options or leave them blank if you eat everything!</p>
          <p><strong>Tip:</strong> These will help personalize your meal recommendations.</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="recipe-types-section"]',
      content: (
        <div>
          <h4>Pick Your Favorite Cuisines</h4>
          <p>Choose the types of food you enjoy. This helps us suggest meals you'll love!</p>
          <p><strong>Pro tip:</strong> The more you select, the more variety you'll get in your meal plans.</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="preferred-proteins-section"]',
      content: (
        <div>
          <h4>Select Your Preferred Proteins</h4>
          <p>Tell us which proteins you like to eat. This ensures your meals include ingredients you actually want!</p>
          <p>Don't worry - you can always change these later in your profile.</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="meal-schedule-section"]',
      content: (
        <div>
          <h4>Plan Your Meal Schedule</h4>
          <p>Choose which meals you want in your plan. Most people select breakfast, lunch, and dinner, but you can customize this however you like!</p>
          <p><strong>Tip:</strong> Including snacks can help with portion control and energy throughout the day.</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="disliked-ingredients-section"]',
      content: (
        <div>
          <h4>Avoid Ingredients You Dislike</h4>
          <p>Add any ingredients you want to avoid. We'll make sure these don't appear in your meal plans!</p>
          <p>Type an ingredient and press Enter or click the Add button.</p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="save-preferences-button"]',
      content: (
        <div>
          <h4>Save Your Preferences</h4>
          <p>Great job! Now click the Save button to save your preferences.</p>
          <p>Next, we'll show you how to generate your first meal plan!</p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true,
    },
  ],
  menu: [
    {
      target: '[data-testid="menu-settings-panel"]',
      content: (
        <div>
          <h4>Menu Generation Settings</h4>
          <p>Here you can customize your meal plan settings:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li><strong>Days:</strong> How many days to plan for</li>
            <li><strong>People:</strong> Number of people you're cooking for</li>
            <li><strong>Budget:</strong> Your target budget per person</li>
          </ul>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-testid="generate-menu-button"]',
      content: (
        <div>
          <h4>Generate Your Menu</h4>
          <p>Click this button to generate a personalized meal plan based on your preferences!</p>
          <p>Our AI will create a balanced menu that fits your dietary needs and budget.</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="menu-display-area"]',
      content: (
        <div>
          <h4>Your Personalized Menu</h4>
          <p>After generation, your menu will appear here. You can:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>View recipes for each meal</li>
            <li>Swap out meals you don't like</li>
            <li>Save individual recipes to your favorites</li>
          </ul>
        </div>
      ),
      placement: 'top',
    },
  ],
  recipeBrowser: [
    {
      target: '[data-testid="recipe-browser-nav"]',
      content: (
        <div>
          <h4>Recipe Browser</h4>
          <p>Welcome to the Recipe Browser! Here you can explore thousands of recipes beyond your generated meal plans.</p>
          <p>Let's explore the features available here.</p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-testid="recipe-search-bar"]',
      content: (
        <div>
          <h4>Search for Recipes</h4>
          <p>Use the search bar to find specific recipes or ingredients. Try searching for your favorite dish!</p>
          <p><strong>Examples:</strong> "chicken pasta", "vegetarian curry", "chocolate cake"</p>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="recipe-filters"]',
      content: (
        <div>
          <h4>Filter Recipes</h4>
          <p>Use these filters to narrow down your search:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li><strong>Diet Type:</strong> Vegetarian, Vegan, Gluten-Free, etc.</li>
            <li><strong>Cuisine:</strong> Italian, Mexican, Asian, etc.</li>
            <li><strong>Cooking Time:</strong> Quick meals under 30 minutes</li>
            <li><strong>Difficulty:</strong> Easy, Medium, or Advanced</li>
          </ul>
        </div>
      ),
      placement: 'right',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="recipe-card"]',
      content: (
        <div>
          <h4>Recipe Cards</h4>
          <p>Each recipe card shows:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>A photo of the dish</li>
            <li>Recipe name and cooking time</li>
            <li>Key nutritional information</li>
            <li>User ratings</li>
          </ul>
          <p>Click on any recipe to see the full details!</p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="save-recipe-button"]',
      content: (
        <div>
          <h4>Save Recipes</h4>
          <p>Found a recipe you love? Click the heart icon to save it to your favorites!</p>
          <p>You can access all your saved recipes from your profile anytime.</p>
        </div>
      ),
      placement: 'left',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="rate-recipe-button"]',
      content: (
        <div>
          <h4>Rate Recipes</h4>
          <p>After trying a recipe, come back and rate it! Your ratings help:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>Other users find great recipes</li>
            <li>Us improve recipe recommendations for you</li>
            <li>Track which recipes you've tried</li>
          </ul>
        </div>
      ),
      placement: 'left',
      spotlightClicks: true,
    },
  ],
  shoppingList: [
    {
      target: '[data-testid="shopping-list-overview"]',
      content: (
        <div>
          <h4>Your Shopping List</h4>
          <p>Here's your automatically generated shopping list based on your meal plan!</p>
          <p>All ingredients are organized by category to make shopping easier.</p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-testid="store-selector"]',
      content: (
        <div>
          <h4>Select Your Store</h4>
          <p>Choose your preferred grocery store to:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>See real-time prices</li>
            <li>Check product availability</li>
            <li>Order groceries for pickup or delivery</li>
          </ul>
        </div>
      ),
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-testid="list-categories"]',
      content: (
        <div>
          <h4>Organized by Category</h4>
          <p>Your list is organized by store sections (Produce, Dairy, Meat, etc.) to help you shop efficiently.</p>
          <p>Check off items as you shop!</p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3>You're All Set! 🎊</h3>
          <p>Congratulations! You now know how to:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>✅ Set your dietary preferences</li>
            <li>✅ Generate personalized meal plans</li>
            <li>✅ Browse and save recipes</li>
            <li>✅ Create shopping lists</li>
          </ul>
          <p style={{ marginTop: '15px' }}><strong>What's next?</strong> Start exploring and enjoying your personalized meal planning experience!</p>
        </div>
      ),
      placement: 'center',
    },
  ],
};

const OnboardingWalkthrough = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [currentSection, setCurrentSection] = useState(null);
  const [walkthroughProgress, setWalkthroughProgress] = useState({
    preferences_completed: false,
    menu_completed: false,
    recipe_browser_completed: false,
    shopping_completed: false,
    completed: false,
  });

  // Load walkthrough progress from localStorage and API
  useEffect(() => {
    const loadProgress = async () => {
      // Check localStorage first
      const storedProgress = localStorage.getItem('walkthroughProgress');
      if (storedProgress) {
        const progress = JSON.parse(storedProgress);
        setWalkthroughProgress(progress);
        
        // If walkthrough is already completed, don't run it
        if (progress.completed) {
          return;
        }
      }

      // Load from API if user is logged in
      if (user?.id) {
        try {
          const response = await apiService.get(`/auth/user/${user.id}`);
          if (response.data) {
            const apiProgress = {
              preferences_completed: response.data.walkthrough_preferences_completed || false,
              menu_completed: response.data.walkthrough_menu_completed || false,
              recipe_browser_completed: response.data.walkthrough_recipe_browser_completed || false,
              shopping_completed: response.data.walkthrough_shopping_completed || false,
              completed: response.data.walkthrough_completed || false,
            };
            setWalkthroughProgress(apiProgress);
            localStorage.setItem('walkthroughProgress', JSON.stringify(apiProgress));
            
            // If walkthrough is already completed, don't run it
            if (apiProgress.completed) {
              return;
            }
          }
        } catch (error) {
          console.error('Error loading walkthrough progress:', error);
        }
      }

      // Determine which section to show based on current page
      determineSectionToShow();
    };

    loadProgress();
  }, [user, location.pathname]);

  // Determine which walkthrough section to show based on current page
  const determineSectionToShow = useCallback(() => {
    const path = location.pathname;

    // Don't show walkthrough if already completed
    if (walkthroughProgress.completed) {
      return;
    }

    if (path === '/preferences' && !walkthroughProgress.preferences_completed) {
      setCurrentSection('preferences');
      setSteps(WALKTHROUGH_STEPS.preferences);
      setRun(true);
    } else if (path === '/menu' && !walkthroughProgress.menu_completed) {
      setCurrentSection('menu');
      setSteps(WALKTHROUGH_STEPS.menu);
      setRun(true);
    } else if (path === '/recipe-browser' && !walkthroughProgress.recipe_browser_completed) {
      setCurrentSection('recipeBrowser');
      setSteps(WALKTHROUGH_STEPS.recipeBrowser);
      setRun(true);
    } else if (path === '/shopping-list' && !walkthroughProgress.shopping_completed) {
      setCurrentSection('shoppingList');
      setSteps(WALKTHROUGH_STEPS.shoppingList);
      setRun(true);
    }
  }, [location.pathname, walkthroughProgress]);

  // Update progress in both localStorage and API
  const updateProgress = async (section, completed = true) => {
    const newProgress = { ...walkthroughProgress };
    
    switch (section) {
      case 'preferences':
        newProgress.preferences_completed = completed;
        break;
      case 'menu':
        newProgress.menu_completed = completed;
        break;
      case 'recipeBrowser':
        newProgress.recipe_browser_completed = completed;
        break;
      case 'shoppingList':
        newProgress.shopping_completed = completed;
        // If shopping list is completed, mark entire walkthrough as complete
        newProgress.completed = true;
        break;
      case 'all':
        // Mark everything as completed (for skip functionality)
        newProgress.preferences_completed = true;
        newProgress.menu_completed = true;
        newProgress.recipe_browser_completed = true;
        newProgress.shopping_completed = true;
        newProgress.completed = true;
        break;
    }

    // Save to localStorage
    localStorage.setItem('walkthroughProgress', JSON.stringify(newProgress));
    setWalkthroughProgress(newProgress);

    // Save to API if user is logged in
    if (user?.id) {
      try {
        await apiService.put(`/auth/progress`, {
          walkthrough_preferences_completed: newProgress.preferences_completed,
          walkthrough_menu_completed: newProgress.menu_completed,
          walkthrough_recipe_browser_completed: newProgress.recipe_browser_completed,
          walkthrough_shopping_completed: newProgress.shopping_completed,
          walkthrough_completed: newProgress.completed,
        });
      } catch (error) {
        console.error('Error updating walkthrough progress:', error);
      }
    }
  };

  // Handle Joyride callbacks
  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Update step index to prevent looping
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Mark current section as completed
      if (currentSection) {
        updateProgress(currentSection);
      }

      // If skipped, mark all sections as completed
      if (status === STATUS.SKIPPED) {
        updateProgress('all');
        setRun(false);
        return;
      }

      // Navigate to next section
      if (currentSection === 'preferences') {
        navigate('/menu');
      } else if (currentSection === 'menu') {
        navigate('/recipe-browser');
      } else if (currentSection === 'recipeBrowser') {
        navigate('/shopping-list');
      } else if (currentSection === 'shoppingList') {
        // Walkthrough complete!
        setRun(false);
      }
    }
  };

  // Don't render if no steps or walkthrough is completed
  if (!run || steps.length === 0 || walkthroughProgress.completed) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      stepIndex={stepIndex}
      styles={joyrideStyles}
      callback={handleJoyrideCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
      floaterProps={{
        disableAnimation: true,
      }}
      disableScrolling={false}
      disableOverlayClose={false}
      spotlightClicks={true}
    />
  );
};

export default OnboardingWalkthrough;