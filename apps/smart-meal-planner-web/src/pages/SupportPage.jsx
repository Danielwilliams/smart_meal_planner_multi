import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip,
  CardActions,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Email as EmailIcon,
  Help as HelpIcon,
  Description as GuideIcon,
  BugReport as BugIcon,
  Feedback as FeedbackIcon,
  School as TutorialIcon,
  PlayArrow as StartIcon,
  CheckCircle as CheckIcon,
  Lightbulb as TipIcon,
  Dashboard as DashboardIcon,
  Restaurant as MenuIcon,
  ShoppingCart as ShoppingIcon,
  Bookmark as BookmarkIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
  List as ListIcon,
  Notes as NotesIcon,
  People as ClientsIcon,
  Assignment as FormsIcon,
  Analytics as ResponsesIcon,
  Palette as BrandingIcon,
  Share as ShareIcon,
  Favorite as RecipesIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

function SupportPage() {
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
      label: 'Set Up Your Preferences',
      description: 'Configure your dietary preferences and restrictions',
      action: () => window.open('/preferences-page', '_blank'),
      icon: <SettingsIcon color="primary" />,
      estimatedTime: '5 minutes'
    },
    {
      label: 'Generate Your First Menu',
      description: 'Create a personalized meal plan using AI',
      action: () => window.open('/menu', '_blank'),
      icon: <MenuIcon color="warning" />,
      estimatedTime: '10 minutes'
    },
    {
      label: 'Save Your Favorite Recipes',
      description: 'Browse and bookmark recipes you love',
      action: () => window.open('/recipes', '_blank'),
      icon: <BookmarkIcon color="secondary" />,
      estimatedTime: '5 minutes'
    },
    {
      label: 'Connect to Grocery Stores',
      description: 'Link your Kroger, Walmart, or Instacart accounts',
      action: () => window.open('/preferences-page', '_blank'),
      icon: <ShoppingIcon color="success" />,
      estimatedTime: '8 minutes'
    },
    {
      label: 'Try the Shopping List',
      description: 'Generate and use your first shopping list',
      action: () => window.open('/shopping-list', '_blank'),
      icon: <ListIcon color="info" />,
      estimatedTime: '5 minutes'
    }
  ];

  const featureCategories = [
    {
      title: 'Meal Planning',
      icon: <MenuIcon color="primary" />,
      description: 'AI-powered meal planning and menu generation',
      features: [
        {
          name: 'AI Menu Generation',
          description: 'Create personalized meal plans based on your preferences and dietary needs',
          benefits: ['Saves time', 'Personalized nutrition', 'Variety in meals', 'Dietary compliance'],
          howTo: 'Go to Menu page → Set duration and meal types → Click Generate Menu',
          path: '/menu'
        },
        {
          name: 'Custom Preferences',
          description: 'Set dietary restrictions, disliked foods, appliances, and macro goals',
          benefits: ['Tailored recommendations', 'Allergen safety', 'Equipment compatibility', 'Nutritional goals'],
          howTo: 'Preferences page → Update dietary settings → Save changes',
          path: '/preferences-page'
        },
        {
          name: 'Menu Regeneration',
          description: 'Regenerate individual meals or entire menus if you don\'t like suggestions',
          benefits: ['Flexibility', 'Better satisfaction', 'Learning your preferences', 'Endless variety'],
          howTo: 'Menu page → Click regenerate button on any meal or the whole menu',
          path: '/menu'
        }
      ]
    },
    {
      title: 'Recipe Management',
      icon: <RecipesIcon color="secondary" />,
      description: 'Discover, save, and organize your favorite recipes',
      features: [
        {
          name: 'Recipe Browser',
          description: 'Search and explore thousands of recipes with filtering options',
          benefits: ['Large recipe database', 'Easy discovery', 'Detailed filtering', 'Nutritional information'],
          howTo: 'Recipe Browser page → Use search and filters → View recipe details',
          path: '/recipes'
        },
        {
          name: 'Saved Recipes',
          description: 'Bookmark your favorite recipes for quick access',
          benefits: ['Personal collection', 'Quick access', 'Easy meal planning', 'Organized favorites'],
          howTo: 'Click bookmark icon on any recipe → View in Saved Recipes page',
          path: '/saved-recipes'
        },
        {
          name: 'Recipe Details',
          description: 'View detailed nutrition info, ingredients, and cooking instructions',
          benefits: ['Complete information', 'Nutritional transparency', 'Cooking guidance', 'Ingredient lists'],
          howTo: 'Click on any recipe → View full details and nutrition facts',
          path: '/recipes'
        }
      ]
    },
    {
      title: 'Shopping & Grocery',
      icon: <ShoppingIcon color="success" />,
      description: 'Streamlined shopping with store integrations',
      features: [
        {
          name: 'Shopping Lists',
          description: 'Auto-generated shopping lists from your meal plans',
          benefits: ['Automatic generation', 'Organized by category', 'Checkoff functionality', 'Never forget ingredients'],
          howTo: 'Generate menu → Go to Shopping List → Check off items as you shop',
          path: '/shopping-list'
        },
        {
          name: 'Store Integration',
          description: 'Connect to Kroger, Walmart, and Instacart for seamless shopping',
          benefits: ['Direct cart addition', 'Price comparison', 'Convenient ordering', 'Time saving'],
          howTo: 'Preferences → Store Connections → Authorize your preferred stores',
          path: '/preferences-page'
        },
        {
          name: 'Cart Management',
          description: 'View and manage items added to your connected store carts',
          benefits: ['Centralized view', 'Easy modifications', 'Order tracking', 'Multiple store support'],
          howTo: 'Cart page → View items from connected stores → Modify as needed',
          path: '/cart'
        }
      ]
    }
  ];

  const workflowSteps = [
    {
      title: 'Initial Setup',
      description: 'Get started with Smart Meal Planner',
      tasks: [
        'Create your account and verify email',
        'Set up dietary preferences and restrictions',
        'Configure disliked foods and ingredients',
        'Set appliance availability',
        'Define macronutrient goals (optional)',
        'Connect grocery store accounts (optional)'
      ]
    },
    {
      title: 'First Meal Plan',
      description: 'Create your first personalized menu',
      tasks: [
        'Navigate to the Menu page',
        'Select meal plan duration (3, 5, or 7 days)',
        'Choose meal types (breakfast, lunch, dinner, snacks)',
        'Generate your first menu',
        'Review and regenerate any meals you don\'t like',
        'Save favorite recipes to your collection'
      ]
    },
    {
      title: 'Shopping & Cooking',
      description: 'Turn your meal plan into action',
      tasks: [
        'Generate shopping list from your menu',
        'Review and modify the shopping list',
        'Add items to connected store carts or shop manually',
        'Use recipes for cooking guidance',
        'Rate recipes and provide feedback',
        'Update preferences based on experience'
      ]
    },
    {
      title: 'Ongoing Use',
      description: 'Make meal planning a habit',
      tasks: [
        'Generate new menus regularly',
        'Explore the recipe browser for variety',
        'Build your saved recipes collection',
        'Refine preferences over time',
        'Try different meal plan durations',
        'Share feedback to improve the AI'
      ]
    }
  ];

  const tips = [
    {
      title: 'Start Simple',
      content: 'Begin with basic preferences and gradually add more specific restrictions as you learn what works for you.'
    },
    {
      title: 'Be Specific with Dislikes',
      content: 'Add specific ingredients you dislike to get better recommendations. The AI learns from your preferences.'
    },
    {
      title: 'Use the Regenerate Feature',
      content: 'Don\'t settle for meals you don\'t want. Regenerate individual meals or entire menus until you\'re satisfied.'
    },
    {
      title: 'Connect Your Stores Early',
      content: 'Link your grocery accounts in preferences to make shopping seamless from day one.'
    },
    {
      title: 'Save Everything You Like',
      content: 'Bookmark recipes liberally. Your saved recipes become the foundation for future meal planning.'
    },
    {
      title: 'Check Shopping Lists',
      content: 'Always review auto-generated shopping lists before shopping. You may already have some ingredients.'
    },
    {
      title: 'Update Preferences Regularly',
      content: 'As your tastes change or you try new foods, update your preferences to get better recommendations.'
    },
    {
      title: 'Try Different Durations',
      content: 'Experiment with 3, 5, and 7-day meal plans to find what works best for your lifestyle.'
    }
  ];

  const getCompletionPercentage = () => {
    return Math.round((completedSteps.length / quickStartSteps.length) * 100);
  };

  const faqs = [
    {
      question: "How do I generate a meal plan?",
      answer: "Navigate to the Menu page, select your preferences (duration, meal types, dietary restrictions), and click 'Generate Menu'. The AI will create a personalized meal plan based on your preferences."
    },
    {
      question: "How do I save recipes?",
      answer: "When viewing a meal plan or recipe, click the bookmark icon to save it to your favorites. You can view all saved recipes on the 'Saved Recipes' page."
    },
    {
      question: "How do I connect to grocery stores?",
      answer: "Go to your preferences and look for store integration options. You can connect to Kroger, Walmart, and Instacart to automatically add ingredients to your cart."
    },
    {
      question: "How do I modify my dietary preferences?",
      answer: "Visit the Preferences page to update your dietary restrictions, disliked foods, appliances, macronutrient goals, and other meal planning preferences."
    },
    {
      question: "What if I don't like a generated recipe?",
      answer: "You can regenerate individual meals or the entire menu. You can also add specific foods to your 'disliked ingredients' list in preferences to avoid them in future meal plans."
    },
    {
      question: "How do shopping lists work?",
      answer: "After generating a meal plan, visit the Shopping List page to see all ingredients needed. You can check off items as you shop, or send the list directly to connected grocery stores."
    }
  ];

  const supportOptions = [
    {
      title: "Email Support",
      description: "Send us an email for personalized help",
      icon: <EmailIcon />,
      action: "Contact Support",
      link: "mailto:support@smartmealplanner.ai"
    },
    {
      title: "Report a Bug",
      description: "Found something not working right?",
      icon: <BugIcon />,
      action: "Report Bug",
      link: "mailto:bugs@smartmealplanner.ai?subject=Bug Report"
    },
    {
      title: "Feature Request",
      description: "Suggest new features or improvements",
      icon: <FeedbackIcon />,
      action: "Send Feedback",
      link: "mailto:feedback@smartmealplanner.ai?subject=Feature Request"
    }
  ];

  const quickLinks = [
    { text: "Set Up Preferences", path: "/preferences-page" },
    { text: "Generate Your First Menu", path: "/menu" },
    { text: "Connect Grocery Stores", path: "/preferences-page" },
    { text: "Browse Recipe Library", path: "/recipes" },
    { text: "View Shopping List", path: "/shopping-list" }
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Header */}
      <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ textAlign: 'center' }}>
          <HelpIcon sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            Smart Meal Planner Support
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, mb: 3 }}>
            Everything you need to master your meal planning journey
          </Typography>
          
          {completedSteps.length > 0 && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Quick Start Progress: {getCompletionPercentage()}% Complete
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
          <Tab label="Step-by-Step Guide" icon={<TutorialIcon />} />
          <Tab label="Tips & FAQ" icon={<TipIcon />} />
          <Tab label="Get Support" icon={<EmailIcon />} />
        </Tabs>
      </Paper>

      {/* Quick Start Tab */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Quick Start Guide
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Follow these essential steps to get started with Smart Meal Planner in about 30 minutes.
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
            Explore all the powerful features available to enhance your meal planning experience.
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
                        {feature.path && (
                          <CardActions>
                            <Button 
                              size="small"
                              component={RouterLink}
                              to={feature.path}
                            >
                              Try Feature
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

      {/* Step-by-Step Guide Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Complete Step-by-Step Guide
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Follow this comprehensive guide to get the most out of Smart Meal Planner.
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

      {/* Tips & FAQ Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Tips & Frequently Asked Questions
          </Typography>
          
          {/* Tips Section */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            💡 Pro Tips
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
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

          {/* FAQ Section */}
          <Typography variant="h6" gutterBottom>
            ❓ Frequently Asked Questions
          </Typography>
          <Box sx={{ mt: 2 }}>
            {faqs.map((faq, index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">{faq.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography>{faq.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>
      )}

      {/* Get Support Tab */}
      {activeTab === 4 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Get Help & Support
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Need additional help? We're here to support your meal planning journey.
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom>
                    <HelpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Contact Support
                  </Typography>
                  <Grid container spacing={2}>
                    {supportOptions.map((option, index) => (
                      <Grid item xs={12} sm={4} key={index}>
                        <Box
                          sx={{
                            p: 2,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            textAlign: 'center',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <Box>
                            {option.icon}
                            <Typography variant="h6" sx={{ mt: 1 }}>
                              {option.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {option.description}
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            href={option.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {option.action}
                          </Button>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom>
                    <TutorialIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Quick Links
                  </Typography>
                  <List>
                    {quickLinks.map((link, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemText>
                          <Button
                            component={RouterLink}
                            to={link.path}
                            variant="text"
                            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            fullWidth
                          >
                            {link.text}
                          </Button>
                        </ListItemText>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Additional Resources */}
          <Card sx={{ mt: 4 }}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Additional Resources
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>Tips for Better Meal Planning</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Set up your dietary preferences first for personalized results" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Use the 'disliked ingredients' feature to avoid foods you don't enjoy" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Connect your grocery store accounts for seamless shopping" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Save recipes you love for easy access later" />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>System Requirements</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Modern web browser (Chrome, Firefox, Safari, Edge)" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Stable internet connection" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="JavaScript enabled" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Cookies enabled for login functionality" />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
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
            component={RouterLink}
            to="/menu"
          >
            Create First Menu
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          You can always return to this support center anytime.
        </Typography>
      </Box>
    </Container>
  );
}

export default SupportPage;