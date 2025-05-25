import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Box,
  Link,
  CircularProgress
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import apiService from '../services/apiService';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Check if token is present on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Attempting password reset with token:', token?.substring(0, 20) + '...');
      const response = await apiService.resetPassword(token, newPassword);
      console.log('✅ Password reset response:', response);
      
      if (response) {
        console.log('✅ Setting success to true');
        setSuccess(true);
      } else {
        console.log('❌ No response received');
        setError('No response from server');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
        
        // Handle specific error cases
        if (errorMessage.includes('expired')) {
          errorMessage = 'This reset link has expired. Please request a new password reset.';
        } else if (errorMessage.includes('Invalid')) {
          errorMessage = 'This reset link is invalid. Please request a new password reset.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  console.log('🔍 ResetPasswordPage render - success state:', success);
  
  if (success) {
    console.log('✅ Rendering success UI');
    return (
      <Container maxWidth="sm">
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          mt: 8 
        }}>
          <Card sx={{ width: '100%', maxWidth: 400 }}>
            <CardContent>
              <Typography 
                component="h1" 
                variant="h5" 
                align="center" 
                gutterBottom
              >
                Password Reset Complete
              </Typography>

              <Alert severity="success" sx={{ mb: 3 }}>
                Your password has been successfully reset!
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You can now log in with your new password.
              </Typography>

              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        mt: 8 
      }}>
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent>
            <Typography 
              component="h1" 
              variant="h5" 
              align="center" 
              gutterBottom
            >
              Reset Password
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your new password below.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
                {(error.includes('expired') || error.includes('invalid')) && (
                  <Box sx={{ mt: 1 }}>
                    <Link 
                      component={RouterLink} 
                      to="/forgot-password"
                      variant="body2"
                    >
                      Request a new password reset
                    </Link>
                  </Box>
                )}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="newPassword"
                label="New Password"
                type="password"
                id="newPassword"
                autoComplete="new-password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || !token}
                helperText="Password must be at least 6 characters long"
              />
              
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !token}
                error={confirmPassword && newPassword !== confirmPassword}
                helperText={
                  confirmPassword && newPassword !== confirmPassword 
                    ? "Passwords do not match" 
                    : ""
                }
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
                disabled={
                  loading || 
                  !token || 
                  !newPassword || 
                  !confirmPassword || 
                  newPassword !== confirmPassword ||
                  newPassword.length < 6
                }
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link 
                component={RouterLink} 
                to="/login" 
                variant="body2"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowBackIcon sx={{ mr: 0.5, fontSize: 16 }} />
                Back to Login
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default ResetPasswordPage;