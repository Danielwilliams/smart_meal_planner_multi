// src/pages/OrganizationSetup.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useOrganization } from '../context/OrganizationContext';

function OrganizationSetup() {
  const { createOrganization, loading, error } = useOrganization();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const steps = ['Organization Details', 'Review', 'Complete'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is updated
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Organization name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!validateForm()) return;
    }
    
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      const newOrg = await createOrganization(formData);
      setActiveStep(2); // Move to completion step
      
      // Redirect after a brief delay
      setTimeout(() => {
        navigate('/organization/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Organization creation error:', err);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Create Your Organization
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Organization Details
            </Typography>
            <TextField
              name="name"
              label="Organization Name"
              fullWidth
              margin="normal"
              value={formData.name}
              onChange={handleChange}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
            <TextField
              name="description"
              label="Description"
              fullWidth
              margin="normal"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={3}
            />
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Organization Details
            </Typography>
            <Typography variant="subtitle1">
              Organization Name:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {formData.name}
            </Typography>
            
            <Typography variant="subtitle1">
              Description:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {formData.description || 'No description provided'}
            </Typography>
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Organization Created Successfully!
            </Typography>
            <Typography variant="body1">
              Redirecting to your organization dashboard...
            </Typography>
            <CircularProgress sx={{ mt: 2 }} />
          </Box>
        )}

        {activeStep < 2 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={activeStep === 1 ? handleSubmit : handleNext}
              disabled={loading}
            >
              {activeStep === 1 ? 'Create Organization' : 'Next'}
              {loading && <CircularProgress size={24} sx={{ ml: 1 }} />}
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default OrganizationSetup;