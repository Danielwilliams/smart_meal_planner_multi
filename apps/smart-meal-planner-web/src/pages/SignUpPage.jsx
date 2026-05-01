import React, { useState, useCallback } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel,
  CircularProgress, Container, Paper, Divider, Chip
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

function SignUpPage() {
  const navigate = useNavigate();
  
  // Redirect to subscription page immediately  
  React.useEffect(() => {
    navigate('/subscription');
  }, [navigate]);

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Redirecting to subscription plans...
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default SignUpPage;