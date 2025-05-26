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
  ListItemText,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress
} from '@mui/material';
import {
  Business as OrgIcon,
  People as ClientsIcon,
  Assignment as FormsIcon,
  Restaurant as MenuIcon,
  Analytics as ResponsesIcon,
  Email as InviteIcon,
  Settings as SettingsIcon,
  PlayArrow as StartIcon,
  CheckCircle as CheckIcon,
  Lightbulb as TipIcon,
  ExpandMore as ExpandMoreIcon,
  Dashboard as DashboardIcon,
  Share as ShareIcon,
  Favorite as RecipesIcon,
  ShoppingCart as ShoppingIcon,
  School as LearnIcon,
  Notes as NotesIcon
} from '@mui/icons-material';

const OrganizationGettingStarted = ({ onNavigateToTab, onComplete, organizationName }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const markStepCompleted = (stepIndex) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }
  };

  const quickStartSteps = [
    {
      label: 'Set Up Your Organization Profile',
      description: 'Complete your organization information and preferences',
      action: () => onNavigateToTab(6), // Settings tab
      icon: <OrgIcon color="primary" />,
      estimatedTime: '5 minutes'
    },
    {
      label: 'Invite Your First Client',
      description: 'Send an invitation to bring your first client onboard',
      action: () => onNavigateToTab(1), // Invitations tab
      icon: <InviteIcon color="secondary" />,
      estimatedTime: '2 minutes'
    },
    {
      label: 'Create a Custom Onboarding Form',
      description: 'Design intake forms to better understand your clients',
      action: () => onNavigateToTab(4), // Onboarding Forms tab
      icon: <FormsIcon color="success" />,
      estimatedTime: '10 minutes'
    },
    {
      label: 'Create Your First Menu',
      description: 'Build a meal plan to share with clients',
      action: () => window.open('/menu', '_blank'),
      icon: <MenuIcon color="warning" />,
      estimatedTime: '15 minutes'
    }
  ];

  const featureCategories = [
    {
      title: 'Client Management',
      icon: <ClientsIcon color="primary" />,
      description: 'Manage your client relationships and communications',
      features: [
        {
          name: 'Client Invitations',
          description: 'Send email invitations to potential clients with custom signup links',
          benefits: ['Streamlined onboarding', 'Professional presentation', 'Automatic account creation'],
          howTo: 'Go to Invitations tab → Click "Send Invitation" → Enter client email → Send',
          tab: 1
        },
        {
          name: 'Client Dashboard',
          description: 'View all your clients, their status, and manage their accounts',
          benefits: ['Centralized client overview', 'Quick status checks', 'Easy client management'],
          howTo: 'Clients tab shows all connected clients with status indicators and quick actions',
          tab: 0
        },
        {
          name: 'Client Preferences',
          description: 'Set and manage dietary preferences and restrictions for each client',
          benefits: ['Personalized meal planning', 'Allergy safety', 'Better client satisfaction'],
          howTo: 'Clients tab → Select client → "Set Preferences" button',
          tab: 0
        }
      ]
    },
    {
      title: 'Custom Onboarding',
      icon: <FormsIcon color="success" />,
      description: 'Create personalized intake forms for new clients',
      features: [
        {
          name: 'Form Builder',
          description: 'Design custom forms with 8 different field types including text, select, radio, checkbox',
          benefits: ['Collect specific information', 'Professional intake process', 'Consistent data collection'],
          howTo: 'Onboarding Forms tab → Form Builder → Add fields → Preview → Save & Activate',
          tab: 4
        },
        {
          name: 'Client Responses',
          description: 'Review all client form submissions and add private notes',
          benefits: ['Better client understanding', 'Preparation for consultations', 'Response tracking'],
          howTo: 'Onboarding Forms tab → Client Responses → View details → Add notes',
          tab: 4
        },
        {
          name: 'Form Templates',
          description: 'Start with pre-built templates for common intake scenarios',
          benefits: ['Quick setup', 'Best practice examples', 'Time saving'],
          howTo: 'Onboarding Forms tab → Use Template button → Customize as needed',
          tab: 4
        }
      ]
    },
    {
      title: 'Meal Planning & Sharing',
      icon: <MenuIcon color="warning" />,
      description: 'Create and share personalized meal plans with clients',
      features: [
        {
          name: 'Menu Creation',
          description: 'Build custom meal plans using AI assistance or manual selection',
          benefits: ['Personalized nutrition', 'Time-efficient planning', 'Professional presentation'],
          howTo: 'Menu button in navigation → Create new menu → Select recipes → Share with clients',
          tab: null
        },
        {
          name: 'Shared Menus',
          description: 'View and manage all menus shared with clients',
          benefits: ['Track shared content', 'Manage permissions', 'Update shared plans'],
          howTo: 'Shared Menus tab shows all your shared meal plans with management options',
          tab: 2
        },
        {
          name: 'Client Recipes',
          description: 'Access and manage recipes saved by your clients',
          benefits: ['Understand client preferences', 'Recipe recommendations', 'Menu planning insights'],
          howTo: 'Client Recipes tab → Select client → View their saved recipes',
          tab: 3
        }
      ]
    },
    {
      title: 'Organization Settings',
      icon: <SettingsIcon color="error" />,
      description: 'Configure your organization profile and preferences',
      features: [
        {
          name: 'Organization Profile',
          description: 'Set up your business information, contact details, and branding',
          benefits: ['Professional appearance', 'Client trust', 'Brand consistency'],
          howTo: 'Settings tab → Organization Settings → Update profile information',
          tab: 5
        },
        {
          name: 'Default Preferences',
          description: 'Set default dietary preferences for new clients',
          benefits: ['Consistent starting point', 'Faster client setup', 'Reduced manual work'],
          howTo: 'Settings tab → Configure default client preferences',
          tab: 5
        },
        {
          name: 'Access Management',
          description: 'Manage who can access your organization and their permissions',
          benefits: ['Security control', 'Team collaboration', 'Organized workflow'],
          howTo: 'Settings tab → Manage team access and permissions',
          tab: 6
        }
      ]
    },
    {
      title: 'Client Notes & Documentation',
      icon: <NotesIcon color="info" />,
      description: 'Keep private notes about your clients for better service delivery',
      features: [
        {
          name: 'Client Notes',
          description: 'Create and manage private notes for each client including consultations, observations, and goals',
          benefits: ['Track client progress', 'Prepare for sessions', 'Record important observations', 'Maintain professional documentation'],
          howTo: 'Client Notes tab → Select client → Add notes with different types and priorities',
          tab: 5
        },
        {
          name: 'Note Templates',
          description: 'Create reusable note templates for common consultation scenarios',
          benefits: ['Consistent documentation', 'Time-saving', 'Professional structure', 'Standardized approach'],
          howTo: 'Client Notes tab → Use template when creating notes',
          tab: 5
        },
        {
          name: 'Note Organization',
          description: 'Organize notes by type, priority, tags, and search through content',
          benefits: ['Easy retrieval', 'Categorized information', 'Quick search', 'Priority management'],
          howTo: 'Client Notes tab → Use filters, search, and tags to organize notes',
          tab: 5
        }
      ]
    }
  ];

  const workflowSteps = [
    {
      title: 'Initial Setup',
      description: 'Get your organization ready for clients',
      tasks: [
        'Complete organization profile in Settings',
        'Set default client preferences',
        'Create your first onboarding form',
        'Test the client signup process'
      ]
    },
    {
      title: 'Client Onboarding',
      description: 'Bring new clients into your system',
      tasks: [
        'Send invitation email to client',
        'Client creates account and completes onboarding forms',
        'Review client responses and add notes',
        'Set specific preferences for the client'
      ]
    },
    {
      title: 'Service Delivery',
      description: 'Provide ongoing nutrition services',
      tasks: [
        'Create personalized meal plans',
        'Share menus with clients',
        'Monitor client recipe preferences',
        'Update plans based on client feedback'
      ]
    },
    {
      title: 'Ongoing Management',
      description: 'Maintain and grow your practice',
      tasks: [
        'Review client responses regularly',
        'Update onboarding forms as needed',
        'Analyze shared menu performance',
        'Invite additional clients'
      ]
    }
  ];

  const tips = [
    {
      title: 'Start Small',
      content: 'Begin with 1-2 essential onboarding questions and expand gradually based on what information you actually use.'
    },
    {
      title: 'Test Everything',
      content: 'Use the preview functions to test forms and menus from a client\'s perspective before activating.'
    },
    {
      title: 'Stay Organized',
      content: 'Use the notes feature in client responses to track follow-up actions and important observations.'
    },
    {
      title: 'Leverage Templates',
      content: 'Start with form templates and customize them to match your specific practice needs.'
    },
    {
      title: 'Regular Reviews',
      content: 'Check client responses and shared menu activity weekly to stay engaged with your clients.'
    }
  ];

  const getCompletionPercentage = () => {
    return Math.round((completedSteps.length / quickStartSteps.length) * 100);
  };

  return (
    <Box>
      {/* Welcome Header */}
      <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ textAlign: 'center' }}>
          <DashboardIcon sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            Welcome to {organizationName || 'Your Organization'}
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, mb: 3 }}>
            Your complete platform for client nutrition management
          </Typography>
          
          {completedSteps.length > 0 && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Setup Progress: {getCompletionPercentage()}% Complete
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={getCompletionPercentage()} 
                sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)' }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Quick Start" icon={<StartIcon />} />
          <Tab label="All Features" icon={<DashboardIcon />} />
          <Tab label="Workflow Guide" icon={<LearnIcon />} />
          <Tab label="Tips & Best Practices" icon={<TipIcon />} />
        </Tabs>
      </Paper>

      {/* Quick Start Tab */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Quick Start Guide
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Follow these essential steps to get your organization up and running in about 30 minutes.
          </Typography>
          
          <Grid container spacing={3}>
            {quickStartSteps.map((step, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card sx={{ 
                  height: '100%',
                  border: completedSteps.includes(index) ? '2px solid' : '1px solid',
                  borderColor: completedSteps.includes(index) ? 'success.main' : 'grey.300'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      {completedSteps.includes(index) ? (
                        <CheckIcon color="success" />
                      ) : (
                        step.icon
                      )}
                      <Box>
                        <Typography variant="h6">
                          Step {index + 1}: {step.label}
                        </Typography>
                        <Chip label={step.estimatedTime} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      variant={completedSteps.includes(index) ? "outlined" : "contained"}
                      onClick={() => {
                        step.action();
                        markStepCompleted(index);
                      }}
                      disabled={completedSteps.includes(index)}
                    >
                      {completedSteps.includes(index) ? 'Completed' : 'Start Step'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* All Features Tab */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Complete Feature Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Explore all the powerful features available to manage your nutrition practice effectively.
          </Typography>
          
          {featureCategories.map((category, categoryIndex) => (
            <Accordion key={categoryIndex} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {category.icon}
                  <Box>
                    <Typography variant="h6">{category.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.description}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  {category.features.map((feature, featureIndex) => (
                    <Grid item xs={12} md={6} lg={4} key={featureIndex}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {feature.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {feature.description}
                          </Typography>
                          
                          <Typography variant="subtitle2" gutterBottom>
                            Benefits:
                          </Typography>
                          <List dense>
                            {feature.benefits.map((benefit, benefitIndex) => (
                              <ListItem key={benefitIndex} sx={{ px: 0, py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 20 }}>
                                  <CheckIcon color="success" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={benefit}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                          
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="caption">
                              <strong>How to use:</strong> {feature.howTo}
                            </Typography>
                          </Alert>
                        </CardContent>
                        {feature.tab !== null && (
                          <CardActions>
                            <Button 
                              size="small"
                              onClick={() => onNavigateToTab(feature.tab)}
                            >
                              Go to Feature
                            </Button>
                          </CardActions>
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Workflow Guide Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Complete Workflow Guide
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Follow this comprehensive workflow to maximize your success with client management.
          </Typography>
          
          <Stepper activeStep={activeStep} orientation="vertical">
            {workflowSteps.map((step, index) => (
              <Step key={step.title}>
                <StepLabel 
                  onClick={() => setActiveStep(index)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Typography variant="h6">{step.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <List>
                    {step.tasks.map((task, taskIndex) => (
                      <ListItem key={taskIndex}>
                        <ListItemIcon>
                          <CheckIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={task} />
                      </ListItem>
                    ))}
                  </List>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setActiveStep(index + 1)}
                      disabled={index === workflowSteps.length - 1}
                    >
                      {index === workflowSteps.length - 1 ? 'Complete' : 'Next Phase'}
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Tips & Best Practices Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Tips & Best Practices
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Learn from successful nutrition professionals who use this platform effectively.
          </Typography>
          
          <Grid container spacing={3}>
            {tips.map((tip, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <TipIcon color="warning" />
                      <Typography variant="h6">{tip.title}</Typography>
                    </Box>
                    <Typography variant="body1">
                      {tip.content}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Paper sx={{ p: 3, mt: 4, bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Typography variant="h6" gutterBottom>
              Need More Help?
            </Typography>
            <Typography variant="body1" paragraph>
              Our support team is here to help you succeed. Don't hesitate to reach out if you have questions or need guidance with any feature.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" color="primary">
                Contact Support
              </Button>
              <Button variant="outlined" color="primary">
                View Documentation
              </Button>
              <Button variant="outlined" color="primary">
                Schedule Training Call
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Action Footer */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Divider sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          Ready to Get Started?
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<StartIcon />}
            onClick={() => setActiveTab(0)}
          >
            Begin Quick Start
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={onComplete}
          >
            Skip to Dashboard
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          You can always return to this guide from the Settings tab.
        </Typography>
      </Box>
    </Box>
  );
};

export default OrganizationGettingStarted;