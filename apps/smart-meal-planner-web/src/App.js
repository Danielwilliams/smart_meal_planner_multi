import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
// Import theme
import theme from './theme';
// Import components
import NavBar from './components/NavBar';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import PreferencesPage from './pages/PreferencesPage';
import MenuDisplayPage from './pages/MenuDisplayPage';
import ShoppingListPage from './pages/ShoppingListPage';
import CartPage from './pages/CartPage';  // Add this import
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
// Import PrivateRoute component
import PrivateRoute from './components/PrivateRoute';
import ExampleMealPlansPage from './pages/ExampleMealPlansPage';
import VerifyEmailPage from './pages/VerifyEmailPage';


function App() {
  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6Lf2l8MqAAAAAC9fWHMdG8vFbwPfYHvE5jgxFCzT"
      scriptProps={{
        async: false,
        defer: false,
        appendTo: 'head'
      }}
    >
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <NavBar />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/example-meal-plans" element={<ExampleMealPlansPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              
              {/* Protected Routes */}
              <Route 
                path="/home" 
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/preferences-page" 
                element={
                  <PrivateRoute>
                    <PreferencesPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/menu" 
                element={
                  <PrivateRoute>
                    <MenuDisplayPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/shopping-list" 
                element={
                  <PrivateRoute>
                    <ShoppingListPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/cart" 
                element={
                  <PrivateRoute>
                    <CartPage />
                  </PrivateRoute>
                } 
              />
              
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </GoogleReCaptchaProvider>
  );
}

export default App;
