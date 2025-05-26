import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiService from '../services/apiService';

const ClientOnboardingForm = ({ organizationId, clientId, onComplete, onSkip }) => {
  const [forms, setForms] = useState([]);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    loadOnboardingForms();
  }, [organizationId]);

  const loadOnboardingForms = async () => {
    try {
      setLoading(true);
      const activeForms = await apiService.getActiveFormsForClient(organizationId);
      setForms(activeForms);
      
      // Initialize responses object
      const initialResponses = {};
      activeForms.forEach(form => {
        initialResponses[form.id] = {};
        form.form_fields.forEach(field => {
          initialResponses[form.id][field.id] = field.type === 'checkbox' ? [] : '';
        });
      });
      setResponses(initialResponses);
    } catch (err) {
      console.error('Error loading onboarding forms:', err);
      setError('Failed to load onboarding forms');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (formId, fieldId, value) => {
    setResponses(prev => ({
      ...prev,
      [formId]: {
        ...prev[formId],
        [fieldId]: value
      }
    }));
    
    // Clear validation error for this field
    setValidationErrors(prev => ({
      ...prev,
      [`${formId}-${fieldId}`]: null
    }));
  };

  const validateForm = (form) => {
    const errors = {};
    const formResponses = responses[form.id] || {};

    form.form_fields.forEach(field => {
      if (field.required) {
        const value = formResponses[field.id];
        
        if (!value || (Array.isArray(value) && value.length === 0) || 
            (typeof value === 'string' && value.trim() === '')) {
          errors[`${form.id}-${field.id}`] = `${field.label} is required`;
        }
      }
      
      // Email validation
      if (field.type === 'email' && formResponses[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formResponses[field.id])) {
          errors[`${form.id}-${field.id}`] = 'Please enter a valid email address';
        }
      }
      
      // Number validation
      if (field.type === 'number' && formResponses[field.id]) {
        if (isNaN(formResponses[field.id])) {
          errors[`${form.id}-${field.id}`] = 'Please enter a valid number';
        }
      }
      
      // Additional validation rules from field.validation
      if (field.validation && formResponses[field.id]) {
        const value = formResponses[field.id];
        
        if (field.validation.minLength && value.length < field.validation.minLength) {
          errors[`${form.id}-${field.id}`] = `Must be at least ${field.validation.minLength} characters`;
        }
        
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          errors[`${form.id}-${field.id}`] = `Must be no more than ${field.validation.maxLength} characters`;
        }
        
        if (field.validation.min && parseFloat(value) < field.validation.min) {
          errors[`${form.id}-${field.id}`] = `Must be at least ${field.validation.min}`;
        }
        
        if (field.validation.max && parseFloat(value) > field.validation.max) {
          errors[`${form.id}-${field.id}`] = `Must be no more than ${field.validation.max}`;
        }
      }
    });

    return errors;
  };

  const handleNext = () => {
    const currentForm = forms[currentFormIndex];
    const errors = validateForm(currentForm);
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors({});
    setCurrentFormIndex(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentFormIndex(prev => prev - 1);
  };

  const handleSubmit = async () => {
    const currentForm = forms[currentFormIndex];
    const errors = validateForm(currentForm);
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      
      // Submit all form responses
      for (const form of forms) {
        await apiService.submitFormResponse(organizationId, form.id, {
          client_id: clientId,
          response_data: responses[form.id]
        });
      }
      
      onComplete && onComplete();
    } catch (err) {
      console.error('Error submitting onboarding responses:', err);
      setError('Failed to submit responses. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field, formId) => {
    const value = responses[formId]?.[field.id] || '';
    const errorKey = `${formId}-${field.id}`;
    const hasError = !!validationErrors[errorKey];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <TextField
            key={field.id}
            fullWidth
            label={field.label}
            placeholder={field.placeholder}
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(formId, field.id, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={validationErrors[errorKey] || field.help_text}
            margin="normal"
          />
        );

      case 'textarea':
        return (
          <TextField
            key={field.id}
            fullWidth
            multiline
            rows={4}
            label={field.label}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleFieldChange(formId, field.id, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={validationErrors[errorKey] || field.help_text}
            margin="normal"
          />
        );

      case 'select':
        return (
          <FormControl key={field.id} fullWidth margin="normal" required={field.required} error={hasError}>
            <FormLabel>{field.label}</FormLabel>
            <Select
              value={value}
              onChange={(e) => handleFieldChange(formId, field.id, e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>{field.placeholder || 'Select an option'}</em>
              </MenuItem>
              {field.options?.map((option, index) => (
                <MenuItem key={index} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {(validationErrors[errorKey] || field.help_text) && (
              <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'}>
                {validationErrors[errorKey] || field.help_text}
              </Typography>
            )}
          </FormControl>
        );

      case 'radio':
        return (
          <FormControl key={field.id} component="fieldset" margin="normal" required={field.required} error={hasError}>
            <FormLabel component="legend">{field.label}</FormLabel>
            <RadioGroup
              value={value}
              onChange={(e) => handleFieldChange(formId, field.id, e.target.value)}
            >
              {field.options?.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={option}
                  control={<Radio />}
                  label={option}
                />
              ))}
            </RadioGroup>
            {(validationErrors[errorKey] || field.help_text) && (
              <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'}>
                {validationErrors[errorKey] || field.help_text}
              </Typography>
            )}
          </FormControl>
        );

      case 'checkbox':
        return (
          <FormControl key={field.id} component="fieldset" margin="normal" required={field.required} error={hasError}>
            <FormLabel component="legend">{field.label}</FormLabel>
            {field.options?.map((option, index) => (
              <FormControlLabel
                key={index}
                control={
                  <Checkbox
                    checked={(value || []).includes(option)}
                    onChange={(e) => {
                      const currentValues = value || [];
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option);
                      handleFieldChange(formId, field.id, newValues);
                    }}
                  />
                }
                label={option}
              />
            ))}
            {(validationErrors[errorKey] || field.help_text) && (
              <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'}>
                {validationErrors[errorKey] || field.help_text}
              </Typography>
            )}
          </FormControl>
        );

      case 'date':
        return (
          <LocalizationProvider key={field.id} dateAdapter={AdapterDateFns}>
            <DatePicker
              label={field.label}
              value={value ? new Date(value) : null}
              onChange={(newValue) => {
                const dateString = newValue ? newValue.toISOString().split('T')[0] : '';
                handleFieldChange(formId, field.id, dateString);
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: "normal",
                  required: field.required,
                  error: hasError,
                  helperText: validationErrors[errorKey] || field.help_text,
                  placeholder: field.placeholder
                }
              }}
            />
          </LocalizationProvider>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (forms.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Welcome!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This organization doesn't have any custom onboarding forms. You can proceed directly to setting up your preferences.
        </Typography>
        <Button variant="contained" onClick={onSkip}>
          Continue to Preferences
        </Button>
      </Paper>
    );
  }

  const currentForm = forms[currentFormIndex];
  const isLastForm = currentFormIndex === forms.length - 1;

  return (
    <Box>
      {/* Progress Stepper */}
      {forms.length > 1 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stepper activeStep={currentFormIndex} alternativeLabel>
            {forms.map((form, index) => (
              <Step key={form.id}>
                <StepLabel>{form.name}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {/* Current Form */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {currentForm.name}
        </Typography>
        
        {currentForm.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {currentForm.description}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form">
          {currentForm.form_fields.map(field => renderField(field, currentForm.id))}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={currentFormIndex === 0}
          >
            Back
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            {onSkip && (
              <Button variant="text" onClick={onSkip}>
                Skip All Forms
              </Button>
            )}
            
            {isLastForm ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={20} /> : null}
              >
                {submitting ? 'Submitting...' : 'Complete Onboarding'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
              >
                Next Form
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ClientOnboardingForm;