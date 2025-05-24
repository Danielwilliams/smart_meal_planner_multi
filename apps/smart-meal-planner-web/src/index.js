// meal_planner_frontend/web/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import App from './App';
import theme from './theme'; // Ensure theme is correctly imported
import { AuthProvider } from './context/AuthContext'; // Import AuthContext
import './index.css';  // optional global styles
import apiService from './services/apiService';
import { fixShoppingListPolling } from './utils/fixShoppingListPolling';
import { BrowserRouter } from 'react-router-dom';

// Global error handler to catch extension errors
window.addEventListener('error', (event) => {
  // Suppress popup.js errors from browser extensions
  if (event.filename && event.filename.includes('popup.js')) {
    event.preventDefault();
    console.warn('Suppressed external popup.js error from browser extension');
    return false;
  }
});

// Apply shopping list polling fix
fixShoppingListPolling(apiService);

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <App /> {/* ✅ Move BrowserRouter inside App.js, not here */}
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);

