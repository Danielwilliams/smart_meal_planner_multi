import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import OnboardingWalkthrough from '../components/ImprovedOnboardingWalkthrough';

const TestWalkthroughPage = () => {
  const { user } = useAuth();
  const [walkthroughProgress, setWalkthroughProgress] = useState({});
  const [loading, setLoading] = useState(false);

  // Load current walkthrough progress
  const loadProgress = async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiService.get('/auth/account-info');
      if (response.data) {
        setWalkthroughProgress({
          preferences_completed: response.data.walkthrough_preferences_completed || false,
          menu_completed: response.data.walkthrough_menu_completed || false,
          recipe_browser_completed: response.data.walkthrough_recipe_browser_completed || false,
          shopping_completed: response.data.walkthrough_shopping_completed || false,
          completed: response.data.walkthrough_completed || false,
        });
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [user]);

  // Reset all walkthrough progress
  const resetWalkthrough = async () => {
    setLoading(true);
    try {
      await apiService.put('/auth/progress', {
        walkthrough_preferences_completed: false,
        walkthrough_menu_completed: false,
        walkthrough_recipe_browser_completed: false,
        walkthrough_shopping_completed: false,
        walkthrough_completed: false,
      });
      
      // Clear localStorage
      localStorage.removeItem('walkthroughProgress');
      
      // Reload progress
      await loadProgress();
      
      alert('Walkthrough progress reset successfully!');
    } catch (error) {
      console.error('Error resetting walkthrough:', error);
      alert('Error resetting walkthrough progress');
    } finally {
      setLoading(false);
    }
  };

  // Set specific step as completed
  const completeStep = async (step) => {
    setLoading(true);
    try {
      const updateData = {};
      updateData[`walkthrough_${step}_completed`] = true;
      
      await apiService.put('/auth/progress', updateData);
      await loadProgress();
      
      alert(`${step} step marked as completed!`);
    } catch (error) {
      console.error('Error updating step:', error);
      alert('Error updating step');
    } finally {
      setLoading(false);
    }
  };

  // Complete entire walkthrough
  const completeWalkthrough = async () => {
    setLoading(true);
    try {
      await apiService.put('/auth/progress', {
        walkthrough_preferences_completed: true,
        walkthrough_menu_completed: true,
        walkthrough_recipe_browser_completed: true,
        walkthrough_shopping_completed: true,
        walkthrough_completed: true,
      });
      
      await loadProgress();
      
      alert('Entire walkthrough marked as completed!');
    } catch (error) {
      console.error('Error completing walkthrough:', error);
      alert('Error completing walkthrough');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Test Walkthrough</h1>
        <p>Please log in to test the walkthrough functionality.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Test Walkthrough</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Walkthrough Progress</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <div className={`p-3 rounded ${walkthroughProgress.preferences_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Preferences:</strong> {walkthroughProgress.preferences_completed ? '✅ Completed' : '❌ Not completed'}
            </div>
            <div className={`p-3 rounded ${walkthroughProgress.menu_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Menu Generation:</strong> {walkthroughProgress.menu_completed ? '✅ Completed' : '❌ Not completed'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className={`p-3 rounded ${walkthroughProgress.recipe_browser_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Recipe Browser:</strong> {walkthroughProgress.recipe_browser_completed ? '✅ Completed' : '❌ Not completed'}
            </div>
            <div className={`p-3 rounded ${walkthroughProgress.shopping_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Shopping List:</strong> {walkthroughProgress.shopping_completed ? '✅ Completed' : '❌ Not completed'}
            </div>
          </div>
        </div>
        
        <div className={`p-4 rounded text-center ${walkthroughProgress.completed ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
          <strong>Overall Status:</strong> {walkthroughProgress.completed ? '🎉 Walkthrough Completed!' : '🔄 Walkthrough In Progress'}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => completeStep('preferences')}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Complete Preferences
          </button>
          
          <button
            onClick={() => completeStep('menu')}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Complete Menu
          </button>
          
          <button
            onClick={() => completeStep('recipe_browser')}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Complete Recipe Browser
          </button>
          
          <button
            onClick={() => completeStep('shopping')}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Complete Shopping
          </button>
          
          <button
            onClick={completeWalkthrough}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Complete All
          </button>
          
          <button
            onClick={resetWalkthrough}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Reset Walkthrough
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Navigation</h2>
        <p className="mb-4">Use these links to navigate to different pages and test the walkthrough:</p>
        
        <div className="space-x-4">
          <a href="/preferences" className="text-blue-600 hover:underline" data-testid="preferences-nav">
            Go to Preferences
          </a>
          <a href="/menu" className="text-blue-600 hover:underline" data-testid="menu-nav">
            Go to Menu
          </a>
          <a href="/recipe-browser" className="text-blue-600 hover:underline" data-testid="recipe-browser-nav">
            Go to Recipe Browser
          </a>
          <a href="/shopping-list" className="text-blue-600 hover:underline" data-testid="shopping-list-nav">
            Go to Shopping List
          </a>
        </div>
      </div>

      {/* Add some test elements with data-testid for walkthrough targeting */}
      <div className="mt-8 space-y-4">
        <div data-testid="diet-types-section" className="p-4 border border-gray-300 rounded">
          <h3 className="font-semibold">Diet Types Section (Test Element)</h3>
          <p>This is a test element for the walkthrough to target.</p>
        </div>
        
        <div data-testid="recipe-types-section" className="p-4 border border-gray-300 rounded">
          <h3 className="font-semibold">Recipe Types Section (Test Element)</h3>
          <p>This is a test element for the walkthrough to target.</p>
        </div>
        
        <div data-testid="save-preferences-button" className="inline-block">
          <button className="bg-gray-300 px-4 py-2 rounded">Save Preferences (Test Button)</button>
        </div>
      </div>

      {/* Include the walkthrough component */}
      <OnboardingWalkthrough />
    </div>
  );
};

export default TestWalkthroughPage;