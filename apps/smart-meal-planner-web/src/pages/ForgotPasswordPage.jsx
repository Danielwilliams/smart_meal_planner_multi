import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiService.forgotPassword(email);
      
      if (response) {
        setSuccess(true);
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
                Check Your Email
              </Typography>

              <Alert severity="success" sx={{ mb: 3 }}>
                If an account with that email exists, we've sent a password reset link to your email address.
              </Alert>

              <Typography variant="body2" color="text.secondary" paragraph>
                Please check your email and click the link to reset your password. 
                The link will expire in 1 hour for security reasons.
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Don't see the email? Check your spam folder or try again with a different email address.
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button 
                  color="primary" 
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </Button>
                <Button 
                  color="secondary" 
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                >
                  Try Different Email
                </Button>
              </Box>
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
              Forgot Password
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email address and we'll send you a link to reset your password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
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

export default ForgotPasswordPage;