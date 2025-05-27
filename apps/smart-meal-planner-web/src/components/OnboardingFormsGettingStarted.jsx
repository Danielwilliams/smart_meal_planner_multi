import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Assignment as FormIcon,
  Visibility as PreviewIcon,
  People as ClientsIcon,
  Analytics as ResponsesIcon,
  CheckCircle as CheckIcon,
  PlayArrow as StartIcon,
  Lightbulb as TipIcon
} from '@mui/icons-material';

const OnboardingFormsGettingStarted = ({ onGetStarted, onUseTemplate }) => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'Create Your First Form',
      description: 'Design custom intake questions for new clients',
      content: (
        <Box>
          <Typography variant="body1" paragraph>
            Start by creating a form with questions that help you understand your clients better. 
            You can ask about dietary restrictions, health goals, preferences, or any information 
            specific to your practice.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Tip:</strong> Start simple with 3-5 essential questions. You can always add more forms later.
          </Alert>
        </Box>
      )
    },
    {
      label: 'Preview & Test',
      description: 'See how clients will experience your form',
      content: (
        <Box>
          <Typography variant="body1" paragraph>
            Use the preview mode to test your form from a client's perspective. This ensures 
            your questions are clear and the form flows smoothly.
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>Best Practice:</strong> Test your form by having a colleague or friend complete it.
          </Alert>
        </Box>
      )
    },
    {
      label: 'Activate & Share',
      description: 'Make your form available to new clients',
      content: (
        <Box>
          <Typography variant="body1" paragraph>
            Once you're happy with your form, activate it. New clients will automatically 
            see your custom forms during their signup process, right after creating their account.
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Note:</strong> Only active forms are shown to clients. You can have multiple forms active at once.
          </Alert>
        </Box>
      )
    },
    {
      label: 'Review Responses',
      description: 'Access client submissions and add notes',
      content: (
        <Box>
          <Typography variant="body1" paragraph>
            View all client responses in the "Client Responses" tab. You can add private notes 
            to track follow-up actions or observations about each client's responses.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Privacy:</strong> Your notes are only visible to you and your organization - clients cannot see them.
          </Alert>
        </Box>
      )
    }
  ];

  const formTemplates = [
    {
      title: 'Basic Health Intake',
      description: 'Essential health and dietary information',
      fields: [
        { label: 'Current Health Conditions', type: 'textarea', placeholder: 'Please list any current health conditions, chronic illnesses, or medical concerns...', required: false, help_text: 'This helps us create meal plans that support your health needs' },
        { label: 'Current Medications', type: 'textarea', placeholder: 'List any medications, supplements, or vitamins you take...', required: false, help_text: 'Some foods may interact with medications' },
        { label: 'Food Allergies', type: 'textarea', placeholder: 'List any food allergies or severe intolerances...', required: true, help_text: 'Critical for meal planning safety' },
        { label: 'Dietary Restrictions', type: 'select', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Other'], required: false, help_text: 'Select your primary dietary approach' },
        { label: 'Primary Health Goals', type: 'checkbox', options: ['Weight Loss', 'Weight Gain', 'Muscle Building', 'Heart Health', 'Diabetes Management', 'Energy Improvement', 'Digestive Health', 'General Wellness'], required: false, help_text: 'Select all that apply' }
      ],
      icon: <FormIcon color="primary" />
    },
    {
      title: 'Lifestyle Assessment',
      description: 'Daily habits and lifestyle preferences',
      fields: [
        { label: 'Activity Level', type: 'radio', options: ['Sedentary (little to no exercise)', 'Lightly Active (light exercise 1-3 days/week)', 'Moderately Active (moderate exercise 3-5 days/week)', 'Very Active (hard exercise 6-7 days/week)', 'Extremely Active (very hard exercise, physical job)'], required: true, help_text: 'This helps determine your caloric needs' },
        { label: 'Cooking Experience', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'Professional'], required: false, help_text: 'Helps us suggest appropriate recipes' },
        { label: 'Available Cooking Time', type: 'radio', options: ['15 minutes or less', '15-30 minutes', '30-60 minutes', '60+ minutes', 'Varies by day'], required: false, help_text: 'How much time do you typically have for meal preparation?' },
        { label: 'Kitchen Equipment', type: 'checkbox', options: ['Basic stovetop/oven', 'Slow cooker', 'Instant Pot/pressure cooker', 'Air fryer', 'Food processor', 'Blender', 'Grill', 'Limited equipment'], required: false, help_text: 'Select all equipment you have access to' },
        { label: 'Meal Planning Preferences', type: 'checkbox', options: ['Batch cooking/meal prep', 'Fresh daily cooking', 'Simple ingredients', 'Complex flavors', 'Family-friendly meals', 'Quick breakfasts', 'Portable lunches'], required: false, help_text: 'Select all that apply to your lifestyle' }
      ],
      icon: <ClientsIcon color="secondary" />
    },
    {
      title: 'Nutrition Goals',
      description: 'Specific nutrition and wellness objectives',
      fields: [
        { label: 'Current Weight', type: 'number', placeholder: 'lbs', required: false, help_text: 'Optional - helps with portion recommendations' },
        { label: 'Goal Weight', type: 'number', placeholder: 'lbs', required: false, help_text: 'Optional - if you have a specific weight goal' },
        { label: 'Timeline for Goals', type: 'select', options: ['1-3 months', '3-6 months', '6-12 months', '1+ years', 'Maintenance/Lifestyle change'], required: false, help_text: 'What timeframe are you working with?' },
        { label: 'Energy Levels', type: 'radio', options: ['Very Low', 'Low', 'Moderate', 'High', 'Very High'], required: false, help_text: 'How would you rate your current energy levels?' },
        { label: 'Specific Concerns', type: 'checkbox', options: ['Blood sugar control', 'High cholesterol', 'High blood pressure', 'Digestive issues', 'Food cravings', 'Emotional eating', 'Irregular eating schedule', 'Poor sleep'], required: false, help_text: 'Select any concerns you\'d like to address' },
        { label: 'Previous Diet Experience', type: 'textarea', placeholder: 'Tell us about previous diets or nutrition programs you\'ve tried...', required: false, help_text: 'What worked well? What didn\'t work?' },
        { label: 'Success Measures', type: 'checkbox', options: ['Weight changes', 'Energy improvements', 'Better sleep', 'Improved lab values', 'Clothing fit', 'Mood improvements', 'Athletic performance', 'Overall wellness'], required: false, help_text: 'How would you like to measure success?' }
      ],
      icon: <ResponsesIcon color="success" />
    }
  ];

  const benefits = [
    'Collect consistent information from all new clients',
    'Save time during initial consultations',
    'Better understand client needs before your first meeting',
    'Create personalized meal plans based on detailed preferences',
    'Track common trends across your client base'
  ];

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ textAlign: 'center' }}>
          <FormIcon sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Welcome to Custom Onboarding Forms
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Create personalized intake forms to better understand your clients from day one
          </Typography>
        </Box>
      </Paper>

      <Grid container spacing={4}>
        {/* Benefits Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TipIcon color="primary" />
                Why Use Custom Forms?
              </Typography>
              <List dense>
                {benefits.map((benefit, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CheckIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={benefit}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Start Steps */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                How It Works
              </Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel 
                      onClick={() => setActiveStep(index)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <Typography variant="subtitle2">{step.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      {step.content}
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setActiveStep(index + 1)}
                          disabled={index === steps.length - 1}
                        >
                          {index === steps.length - 1 ? 'Complete' : 'Next'}
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Template Options */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Start with a Template
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Choose a pre-built template to get started quickly, or create your own from scratch.
        </Typography>
        
        <Grid container spacing={3}>
          {formTemplates.map((template, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {template.icon}
                    <Typography variant="h6">
                      {template.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {template.description}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Includes:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {template.fields.map((field, fieldIndex) => (
                      <Chip
                        key={fieldIndex}
                        label={field.label}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={() => onUseTemplate && onUseTemplate(template)}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Divider sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          Ready to Get Started?
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<StartIcon />}
            onClick={onGetStarted}
          >
            Create My First Form
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<PreviewIcon />}
            onClick={() => window.open('https://docs.example.com/onboarding-forms', '_blank')}
          >
            View Documentation
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Don't worry - you can always edit, preview, and test your forms before activating them.
        </Typography>
      </Box>
    </Box>
  );
};

export default OnboardingFormsGettingStarted;