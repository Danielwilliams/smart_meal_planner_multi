import React, { useState, useCallback } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';



function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState('individual');
  const [organizationName, setOrganizationName] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!executeRecaptcha) {
        throw new Error('reCAPTCHA not initialized');
      }

      const captchaToken = await executeRecaptcha('signup');
      
      // Prepare payload based on account type
      const payload = {
        name,
        email,
        password,
        captchaToken,
        account_type: accountType
      };
      
      // Add organization name if signing up as organization
      if (accountType === 'organization' && organizationName) {
        payload.organization_name = organizationName;
      }
      
      const response = await apiService.signUp(payload);
      setSignupComplete(true);
    } catch (err) {
      console.error('Signup Error:', err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        'An unexpected error occurred during signup'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Create an Account
          </Typography>
          
          <form onSubmit={handleSignUp}>
            <TextField
              label="Name"
              fullWidth
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <FormControl component="fieldset" sx={{ my: 2 }}>
              <FormLabel component="legend">Account Type</FormLabel>
              <RadioGroup
                row
                name="account-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                <FormControlLabel 
                  value="individual" 
                  control={<Radio />} 
                  label="Individual" 
                />
                <FormControlLabel 
                  value="organization" 
                  control={<Radio />} 
                  label="Organization" 
                />
              </RadioGroup>
            </FormControl>
            
            {accountType === 'organization' && (
              <TextField
                label="Organization Name"
                fullWidth
                margin="normal"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            )}
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            
            <Button 
              variant="contained" 
              type="submit"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignUpPage;