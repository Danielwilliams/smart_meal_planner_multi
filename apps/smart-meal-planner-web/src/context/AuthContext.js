import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/apiService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');

      try {
        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          
          // Ensure user object has the correct structure
          const normalizedUser = {
            userId: parsedUser.id || parsedUser.userId || parsedUser.user_id,
            email: parsedUser.email,
            profile_complete: parsedUser.profile_complete || false,
            account_type: parsedUser.account_type,
            progress: {
              has_preferences: parsedUser.progress?.has_preferences || false,
              has_generated_menu: parsedUser.progress?.has_generated_menu || false,
              has_shopping_list: parsedUser.progress?.has_shopping_list || false
            }
          };

          setUser(normalizedUser);
          setAccountType(parsedUser.account_type);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await apiService.login(credentials);
      
      const userData = {
        userId: response.user.id,
        email: response.user.email,
        profile_complete: response.profile_complete,
        account_type: response.account_type,
        progress: {
          has_preferences: response.progress.has_preferences || false,
          has_generated_menu: response.progress.has_generated_menu || false,
          has_shopping_list: response.progress.has_shopping_list || false
        }
      };

      setUser(userData);
      setAccountType(response.account_type);
      setIsAuthenticated(true);
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('access_token', response.access_token);

      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAccountType(null);
    
    // Clear all localStorage items that might contain organization data
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('organization');
    localStorage.removeItem('organizationData');
    localStorage.removeItem('branding');
    localStorage.removeItem('theme');
    
    // Clear any sessionStorage as well
    sessionStorage.clear();
    
    console.log('AuthContext: Logout completed, all storage cleared');
  };

  const updateUserProgress = (progressData) => {
    setUser(prevUser => {
      const updatedUser = {
        ...prevUser,
        progress: {
          ...prevUser.progress,
          ...progressData
        }
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const updateUser = (userData) => {
    setUser(prevUser => {
      const updatedUser = {
        ...prevUser,
        ...userData,
        // Preserve progress data structure
        progress: {
          ...prevUser.progress,
          ...(userData.progress || {})
        }
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      loading,
      accountType,
      login, 
      logout,
      updateUser,
      updateUserProgress 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;