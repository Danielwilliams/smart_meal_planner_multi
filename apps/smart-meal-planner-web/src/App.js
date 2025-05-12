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
import ShoppingListPageDebug from './pages/ShoppingListPageDebug';
import CartPage from './pages/CartPage';  // Add this import
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
// Import PrivateRoute component
import PrivateRoute from './components/PrivateRoute';
import ExampleMealPlansPage from './pages/ExampleMealPlansPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SavedRecipesPage from './pages/SavedRecipesPage';
import RecipeAdminPanel from './pages/RecipeAdminPanel';
import RecipeBrowserPage from './pages/RecipeBrowserPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import CustomMenuBuilderPage from './pages/CustomMenuBuilderPage';
import { OrganizationProvider } from './context/OrganizationContext';
import OrganizationDashboard from './pages/OrganizationDashboard';
import ClientProfile from './pages/ClientProfile';
import AcceptInvitation from './pages/AcceptInvitation';
import ClientPreferencesPage from './pages/ClientPreferencesPage';
import ClientDashboard from './pages/ClientDashboard';
import ClientSignupPage from './pages/ClientSignupPage';
import ClientInvitationConnect from './pages/ClientInvitationConnect';
import KrogerAuthCallback from './pages/KrogerAuthCallback';
import TestInvitation from './TestInvitation';


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
       <OrganizationProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <NavBar />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              {/* Client signup routes - simplified direct access */}
              <Route 
                path="/client-signup" 
                element={<ClientSignupPage />}
              />
              <Route 
                path="/join-as-client" 
                element={<ClientSignupPage />}
              />
              <Route path="/example-meal-plans" element={<ExampleMealPlansPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/connect-to-organization" element={<ClientInvitationConnect />} />
              <Route path="/test-invitation" element={<TestInvitation />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
              <Route path="/kroger/callback" element={<KrogerAuthCallback />} />
              <Route path="/kroger-callback" element={<KrogerAuthCallback />} />
              <Route path="/kroger-auth-callback" element={<KrogerAuthCallback />} />
              {/* These routes are to catch potential redirects from registered URIs */}
              <Route path="/callback" element={<KrogerAuthCallback />} />
              
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
                path="/client-dashboard" 
                element={
                  <PrivateRoute>
                    <ClientDashboard />
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
                path="/menu/:menuId" 
                element={
                  <PrivateRoute>
                    <MenuDisplayPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/menu-display" 
                element={
                  <PrivateRoute>
                    <MenuDisplayPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/menu-display/:menuId" 
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
                path="/shopping-list/:menuId"
                element={
                  <PrivateRoute>
                    <ShoppingListPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/grocery-list/:menuId"
                element={
                  <PrivateRoute>
                    <ShoppingListPage />
                  </PrivateRoute>
                }
              />
              {/* Shopping List Debug Route - Public for easy access */}
              <Route path="/debug/shopping-list" element={<ShoppingListPageDebug />} />
              <Route 
                path="/cart" 
                element={
                  <PrivateRoute>
                    <CartPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/saved-recipes" 
                element={
                  <PrivateRoute>
                    <SavedRecipesPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/organization/dashboard" 
                element={
                  <PrivateRoute>
                    <OrganizationDashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/organization/clients/:clientId" 
                element={
                  <PrivateRoute>
                    <ClientProfile />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/organization/clients/:clientId/preferences" 
                element={
                  <PrivateRoute>
                    <ClientPreferencesPage />
                  </PrivateRoute>
                } 
              />
              {/* Move AcceptInvitation to public routes (outside PrivateRoute) */}
              <Route 
                path="/recipe-admin" 
                element={
                  <PrivateRoute>
                    <RecipeAdminPanel />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/recipes" 
                element={
                  <PrivateRoute>
                    <RecipeBrowserPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/recipes/:id" 
                element={
                  <PrivateRoute>
                    <RecipeDetailPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/custom-menu-builder" 
                element={
                  <PrivateRoute>
                    <CustomMenuBuilderPage />
                  </PrivateRoute>
                } 
              />
              
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ThemeProvider>
       </OrganizationProvider>
      </AuthProvider>
    </GoogleReCaptchaProvider>
  );
}

export default App;