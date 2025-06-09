import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
// Import theme and branding
import theme from './theme';
import { BrandingProvider, withBrandingGuard } from './context/BrandingContext';
// Import components
import NavBar from './components/NavBar';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import CreateAccount from './pages/CreateAccount';
import PreferencesPage from './pages/PreferencesPage';
import MenuDisplayPage from './pages/MenuDisplayPage';
import ShoppingListPage from './pages/ShoppingListPage';
import ShoppingListPageDebug from './pages/ShoppingListPageDebug';
import ShoppingListTestPage from './pages/ShoppingListTestPage';
import TestDebugPage from './pages/TestDebugPage';
import CartPage from './pages/CartPage';  // Add this import
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
// Import PrivateRoute and SubscriptionRoute components
import PrivateRoute from './components/PrivateRoute';
import SubscriptionRoute from './components/SubscriptionRoute';
import ExampleMealPlansPage from './pages/ExampleMealPlansPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SavedRecipesPage from './pages/SavedRecipesPage';
import RecipeAdminPanel from './pages/RecipeAdminPanel';
import RecipeBrowserPage from './pages/RecipeBrowserPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import CustomMenuBuilderPage from './pages/CustomMenuBuilderPage';
import { OrganizationProvider } from './context/OrganizationContext';
import OrganizationDashboard from './pages/OrganizationDashboard';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import ClientProfile from './pages/ClientProfile';
import AcceptInvitation from './pages/AcceptInvitation';
import ClientPreferencesPage from './pages/ClientPreferencesPage';
import ClientDashboard from './pages/ClientDashboard';
import ClientSignupPage from './pages/ClientSignupPage';
import ClientInvitationConnect from './pages/ClientInvitationConnect';
import KrogerAuthCallback from './pages/KrogerAuthCallback';
import KrogerAuth from './pages/KrogerAuth';
import TestInvitation from './TestInvitation';
import ApiTestPage from './pages/ApiTestPage';
import InstacartTestPage from './pages/InstacartTestPage';
import DebugSharedMenus from './pages/DebugSharedMenus';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SupportPage from './pages/SupportPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import SubscriptionCancelPage from './pages/SubscriptionCancelPage';
import UserProfilePage from './pages/UserProfilePage';


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
        <BrandingProvider>
          <CssBaseline />
          <Router>
            <NavBar />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/create-account" element={<CreateAccount />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
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
              <Route path="/kroger-auth" element={<KrogerAuth />} />
              {/* These routes are to catch potential redirects from registered URIs */}
              <Route path="/callback" element={<KrogerAuthCallback />} />
              
              {/* Protected Routes */}
              <Route 
                path="/home" 
                element={
                  <SubscriptionRoute>
                    <Home />
                  </SubscriptionRoute>
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
                  <SubscriptionRoute>
                    <PreferencesPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <SubscriptionRoute>
                    <UserProfilePage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/menu" 
                element={
                  <SubscriptionRoute>
                    <MenuDisplayPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/menu/:menuId" 
                element={
                  <SubscriptionRoute>
                    <MenuDisplayPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/menu-display" 
                element={
                  <SubscriptionRoute>
                    <MenuDisplayPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/menu-display/:menuId" 
                element={
                  <SubscriptionRoute>
                    <MenuDisplayPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/shopping-list" 
                element={
                  <SubscriptionRoute>
                    <ShoppingListPage />
                  </SubscriptionRoute>
                } 
              />
              <Route
                path="/shopping-list/:menuId"
                element={
                  <SubscriptionRoute>
                    <ShoppingListPage />
                  </SubscriptionRoute>
                }
              />
              <Route
                path="/grocery-list/:menuId"
                element={
                  <SubscriptionRoute>
                    <ShoppingListPage />
                  </SubscriptionRoute>
                }
              />
              {/* Debug Routes - Public for easy access */}
              <Route path="/debug/shopping-list" element={<ShoppingListPageDebug />} />
              <Route path="/debug/test" element={<TestDebugPage />} />
              <Route path="/debug/shopping-list-test" element={<ShoppingListTestPage />} />
              <Route path="/debug/api-test" element={<ApiTestPage />} />
              <Route path="/debug/instacart-test" element={<InstacartTestPage />} />
              <Route path="/debug/shared-menus" element={<DebugSharedMenus />} />
              <Route 
                path="/cart" 
                element={
                  <SubscriptionRoute>
                    <CartPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/saved-recipes" 
                element={
                  <SubscriptionRoute>
                    <SavedRecipesPage />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/organization/dashboard" 
                element={
                  <SubscriptionRoute>
                    <OrganizationDashboard />
                  </SubscriptionRoute>
                } 
              />
              <Route 
                path="/organization/settings" 
                element={
                  <SubscriptionRoute>
                    <OrganizationSettingsPage />
                  </SubscriptionRoute>
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
              <Route
                path="/support"
                element={
                  <PrivateRoute>
                    <SupportPage />
                  </PrivateRoute>
                }
              />

              {/* Subscription Routes */}
              <Route
                path="/subscription"
                element={<SubscriptionPage />}
              />
              <Route
                path="/subscription/success"
                element={
                  <PrivateRoute>
                    <SubscriptionSuccessPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/subscription/cancel"
                element={
                  <PrivateRoute>
                    <SubscriptionCancelPage />
                  </PrivateRoute>
                }
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </BrandingProvider>
       </OrganizationProvider>
      </AuthProvider>
    </GoogleReCaptchaProvider>
  );
}

export default App;