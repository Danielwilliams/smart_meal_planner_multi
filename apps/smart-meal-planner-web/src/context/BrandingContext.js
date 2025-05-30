// src/context/BrandingContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';
import apiService from '../services/apiService';

const BrandingContext = createContext();

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

// Create default theme (current platform theme)
const createDefaultTheme = () => {
  return createTheme({
    palette: {
      primary: { main: '#4caf50' },
      secondary: { main: '#ff9800' }
    },
    typography: {
      fontFamily: 'Roboto',
      h4: {
        fontSize: '1.75rem',
        '@media (min-width:600px)': {
          fontSize: '2rem',
        },
      },
      h6: {
        fontSize: '1.1rem',
        '@media (min-width:600px)': {
          fontSize: '1.25rem',
        },
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              minHeight: '44px',
              padding: '8px 16px',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              padding: '12px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              marginBottom: '16px',
            },
          },
        },
      },
    },
  });
};

export const BrandingProvider = ({ children }) => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [branding, setBranding] = useState(null);
  const [theme, setTheme] = useState(createDefaultTheme());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Always reset to default theme first, then load branding if applicable
    setBranding(null);
    setTheme(createDefaultTheme());
    
    // Only load branding after a short delay to ensure theme reset is applied
    const timeoutId = setTimeout(() => {
      loadBranding();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [user, organization]);

  const loadBranding = async () => {
    try {
      setLoading(true);
      
      console.log('BrandingContext: Loading branding for user:', {
        user: user,
        userAccountType: user?.account_type,
        userOrgId: user?.organization_id,
        organizationId: organization?.id,
        organizationData: organization,
        fullOrganizationObject: JSON.stringify(organization)
      });
      
      // If no user, stay with default theme
      if (!user) {
        console.log('BrandingContext: No user, using default theme');
        return;
      }

      // If user is not organization/client, stay with default theme
      if (user?.account_type !== 'organization' && user?.account_type !== 'client') {
        console.log('BrandingContext: Non-organization/client user, using default theme. Account type:', user?.account_type);
        return;
      }

      // Special logging for client accounts
      if (user?.account_type === 'client') {
        console.log('BrandingContext: CLIENT ACCOUNT DETECTED - checking organization link:', {
          clientUserId: user?.userId || user?.id,
          clientOrgId: user?.organization_id,
          organizationContextId: organization?.id,
          organizationContext: organization
        });
      }
      
      // CRITICAL: Only proceed if user is explicitly organization or client type
      if (user?.account_type !== 'organization' && user?.account_type !== 'client') {
        console.log('BrandingContext: User account type is not organization or client, forcing default theme:', user?.account_type);
        return;
      }
      
      // Determine branding context - Apply branding for organization-linked users (owners and clients)
      const organizationId = user?.organization_id || organization?.id;
      
      // Additional safety check - don't load branding if no organization context
      if (!organizationId) {
        console.log('BrandingContext: No organization ID available, staying with default theme');
        return;
      }
      
      console.log('BrandingContext: Organization check:', {
        organizationId,
        userAccountType: user?.account_type,
        shouldLoadBranding: organizationId && (user?.account_type === 'organization' || user?.account_type === 'client')
      });
      
      if (organizationId && (user?.account_type === 'organization' || user?.account_type === 'client')) {
        console.log('BrandingContext: Loading branding for org:', organizationId, 'user type:', user?.account_type);
        // Try to load organization branding
        try {
          const response = await apiService.get(`/api/organization-branding/${organizationId}/branding/public`);
          const brandingData = response;
          
          // Only apply branding if we successfully loaded it
          if (brandingData) {
            console.log('BrandingContext: Successfully loaded branding data');
            const customTheme = createBrandedTheme(brandingData);
            setBranding(brandingData);
            setTheme(customTheme);
          } else {
            console.log('BrandingContext: No branding data received');
          }
        } catch (error) {
          console.warn('Could not load organization branding, using defaults:', error);
          // Keep default theme for any errors
        }
      } else {
        console.log('BrandingContext: No organization context, staying with default theme');
      }
      
    } catch (error) {
      console.error('Error loading branding:', error);
      // Always fallback to default theme on any error
      setBranding(null);
      setTheme(createDefaultTheme());
    } finally {
      setLoading(false);
    }
  };

  const createBrandedTheme = (brandingData) => {
    // Always start with default theme
    const defaultTheme = createDefaultTheme();
    
    // If no branding data or non-organization/client user, return default theme
    if (!brandingData || (user?.account_type !== 'organization' && user?.account_type !== 'client')) {
      return defaultTheme;
    }

    try {
      // Create branded theme by extending default theme
      return createTheme({
        ...defaultTheme,
        palette: {
          ...defaultTheme.palette,
          primary: { main: brandingData.visual?.primaryColor || '#4caf50' },
          secondary: { main: brandingData.visual?.secondaryColor || '#ff9800' },
          accent: { main: brandingData.visual?.accentColor || '#2196f3' }
        },
        typography: {
          ...defaultTheme.typography,
          fontFamily: brandingData.visual?.fontFamily || 'Roboto',
        },
        // Preserve all existing component overrides
        components: defaultTheme.components,
        // Custom branding properties for components to access
        branding: {
          visual: brandingData.visual || {},
          layout: brandingData.layout || {},
          messaging: brandingData.messaging || {},
          features: brandingData.features || {}
        }
      });
    } catch (error) {
      console.error('Error creating branded theme:', error);
      return defaultTheme;
    }
  };

  // Safe branding accessor with fallbacks
  const getSafeBranding = () => {
    return {
      visual: {
        logoUrl: branding?.visual?.logoUrl || null,
        primaryColor: branding?.visual?.primaryColor || '#4caf50',
        secondaryColor: branding?.visual?.secondaryColor || '#ff9800',
        accentColor: branding?.visual?.accentColor || '#2196f3',
        fontFamily: branding?.visual?.fontFamily || 'Roboto',
        customCSS: branding?.visual?.customCSS || ''
      },
      messaging: {
        platformName: branding?.messaging?.platformName || 'Smart Meal Planner',
        tagline: branding?.messaging?.tagline || null,
        footerText: branding?.messaging?.footerText || null,
        supportEmail: branding?.messaging?.supportEmail || 'support@smartmealplanner.com',
        supportPhone: branding?.messaging?.supportPhone || null
      },
      layout: branding?.layout || {
        headerStyle: 'standard',
        sidebarStyle: 'full',
        cardStyle: 'rounded',
        buttonStyle: 'filled'
      },
      features: {
        showPoweredBy: branding?.features?.showPoweredBy !== false, // Default to true
        hideDefaultLogo: branding?.features?.hideDefaultLogo || false,
        customDomain: branding?.features?.customDomain || null
      }
    };
  };

  // Function to check if user should see organization branding
  const shouldShowOrganizationBranding = () => {
    return (
      (user?.account_type === 'organization' || user?.account_type === 'client') && 
      (user?.organization_id || organization?.id) && 
      branding
    );
  };

  const contextValue = {
    branding: getSafeBranding(),
    theme,
    loading,
    loadBranding,
    shouldShowOrganizationBranding,
    // Utility functions for components
    getLogoUrl: () => shouldShowOrganizationBranding() ? branding?.visual?.logoUrl : null,
    getPlatformName: () => shouldShowOrganizationBranding() 
      ? (branding?.messaging?.platformName || 'Smart Meal Planner')
      : 'Smart Meal Planner',
    getSupportEmail: () => shouldShowOrganizationBranding()
      ? (branding?.messaging?.supportEmail || 'support@smartmealplanner.com')
      : 'support@smartmealplanner.com'
  };

  return (
    <BrandingContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </BrandingContext.Provider>
  );
};

// Higher-order component to ensure individual users always get default branding
export const withBrandingGuard = (WrappedComponent) => {
  return (props) => {
    const { user } = useAuth();
    
    // Non-organization users get default theme only
    if (user?.account_type !== 'organization' && user?.account_type !== 'client') {
      return (
        <ThemeProvider theme={createDefaultTheme()}>
          <WrappedComponent {...props} />
        </ThemeProvider>
      );
    }
    
    // Organization users get the full branding system
    return (
      <BrandingProvider>
        <WrappedComponent {...props} />
      </BrandingProvider>
    );
  };
};

export default BrandingContext;