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
      fields: ['Current health conditions', 'Medications', 'Dietary restrictions', 'Health goals'],
      icon: <FormIcon color="primary" />
    },
    {
      title: 'Lifestyle Assessment',
      description: 'Daily habits and lifestyle preferences',
      fields: ['Activity level', 'Cooking experience', 'Time availability', 'Food preferences'],
      icon: <ClientsIcon color="secondary" />
    },
    {
      title: 'Nutrition Goals',
      description: 'Specific nutrition and wellness objectives',
      fields: ['Weight goals', 'Energy levels', 'Specific concerns', 'Previous experience'],
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
                        label={field}
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