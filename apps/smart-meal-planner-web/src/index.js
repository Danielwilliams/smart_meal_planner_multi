// meal_planner_frontend/web/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import App from './App';
import theme from './theme'; // Ensure theme is correctly imported
import { AuthProvider } from './context/AuthContext'; // Import AuthContext
import './index.css';  // optional global styles
import apiService from './services/apiService';
import { BrowserRouter } from 'react-router-dom';

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

