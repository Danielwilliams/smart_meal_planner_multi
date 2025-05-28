import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Link,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Help as HelpIcon,
  Description as DocIcon,
  Restaurant as MealIcon,
  ShoppingCart as CartIcon,
  Person as UserIcon,
  Business as OrgIcon,
  ExpandMore as ExpandMoreIcon,
  Kitchen as KitchenIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Support = () => {
  const { user } = useAuth();
  const isClient = user?.account_type === 'client';
  const isOrganization = user?.account_type === 'organization';

  // Common documentation links
  const commonGuides = [
    {
      title: "Getting Started",
      description: "Learn the basics of using Smart Meal Planner",
      icon: <HelpIcon />,
      link: "/docs/getting-started"
    },
    {
      title: "Recipe Browser",
      description: "How to search, filter, and save recipes",
      icon: <MealIcon />,
      link: "/docs/recipe-browser"
    },
    {
      title: "Shopping Lists",
      description: "Creating and managing shopping lists",
      icon: <CartIcon />,
      link: "/docs/shopping-lists"
    },
    {
      title: "Kroger Integration",
      description: "How to connect and use your Kroger account",
      icon: <CartIcon />,
      link: "/docs/kroger-integration"
    }
  ];

  // Client-specific documentation
  const clientGuides = [
    {
      title: "Client Dashboard",
      description: "Understanding your client dashboard",
      icon: <UserIcon />,
      link: "/docs/client-dashboard"
    },
    {
      title: "Shared Meal Plans",
      description: "Accessing meal plans shared by your nutritionist",
      icon: <MealIcon />,
      link: "/docs/shared-meal-plans"
    }
  ];

  // Organization-specific documentation
  const orgGuides = [
    {
      title: "Organization Dashboard",
      description: "Managing your organization",
      icon: <OrgIcon />,
      link: "/docs/organization-dashboard"
    },
    {
      title: "Client Management",
      description: "Adding and managing clients",
      icon: <UserIcon />,
      link: "/docs/client-management"
    },
    {
      title: "Creating & Sharing Meal Plans",
      description: "Create custom meal plans for clients",
      icon: <MealIcon />,
      link: "/docs/creating-meal-plans"
    }
  ];

  // FAQs relevant to the user type
  const faqs = [
    {
      question: "How do I create a meal plan?",
      answer: "Navigate to the Menu page and click 'Generate Menu'. You can customize meal preferences in your profile settings first for better results.",
      relevantTo: ["all"]
    },
    {
      question: "How do I connect my Kroger account?",
      answer: "Go to the Shopping List or Cart page and click 'Connect Kroger Account'. You'll be redirected to Kroger's website to log in and authorize access.",
      relevantTo: ["all"]
    },
    {
      question: "Why don't I need to enter my Kroger password in the app?",
      answer: "Smart Meal Planner uses OAuth to connect to Kroger, which is more secure. You authenticate directly with Kroger's website instead of storing credentials in our app.",
      relevantTo: ["all"]
    },
    {
      question: "How do I share a meal plan with a client?",
      answer: "From your organization dashboard, select a client, then click 'Create Meal Plan'. After generating the plan, click 'Share with Client'.",
      relevantTo: ["organization"]
    },
    {
      question: "How do I view meal plans from my nutritionist?",
      answer: "Shared meal plans appear on your client dashboard. Click on any plan to view details, recipes, and shopping lists.",
      relevantTo: ["client"]
    }
  ];

  // Filter FAQs based on user type
  const filteredFaqs = faqs.filter(faq => 
    faq.relevantTo.includes("all") || 
    (isClient && faq.relevantTo.includes("client")) ||
    (isOrganization && faq.relevantTo.includes("organization"))
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Support & Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Find help, guides, and answers to common questions about using Smart Meal Planner.
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Quick Help Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Quick Help
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <KitchenIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Meal Planning
                  </Typography>
                  <Typography variant="body2">
                    Generate personalized meal plans based on your preferences and dietary needs.
                  </Typography>
                  <Button 
                    component={Link} 
                    href="/docs/meal-planning"
                    sx={{ mt: 2 }}
                    size="small"
                  >
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <CartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Shopping Lists
                  </Typography>
                  <Typography variant="body2">
                    Automatically generate shopping lists from your meal plans and add items to your cart.
                  </Typography>
                  <Button 
                    component={Link} 
                    href="/docs/shopping-lists"
                    sx={{ mt: 2 }}
                    size="small"
                  >
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Dietary Preferences
                  </Typography>
                  <Typography variant="body2">
                    Set up your dietary preferences, restrictions, and meal preferences for better recommendations.
                  </Typography>
                  <Button 
                    component={Link} 
                    href="/docs/preferences"
                    sx={{ mt: 2 }}
                    size="small"
                  >
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Documentation Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Documentation
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={isOrganization || isClient ? 6 : 12}>
              <Card variant="outlined">
                <CardHeader title="General Guides" />
                <Divider />
                <CardContent>
                  <List>
                    {commonGuides.map((guide, index) => (
                      <ListItem key={index} component={Link} href={guide.link} sx={{ color: 'inherit', textDecoration: 'none' }}>
                        <ListItemIcon>
                          {guide.icon}
                        </ListItemIcon>
                        <ListItemText 
                          primary={guide.title} 
                          secondary={guide.description} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            {isClient && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardHeader title="Client Guides" />
                  <Divider />
                  <CardContent>
                    <List>
                      {clientGuides.map((guide, index) => (
                        <ListItem key={index} component={Link} href={guide.link} sx={{ color: 'inherit', textDecoration: 'none' }}>
                          <ListItemIcon>
                            {guide.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={guide.title} 
                            secondary={guide.description} 
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
            
            {isOrganization && (
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardHeader title="Organization Guides" />
                  <Divider />
                  <CardContent>
                    <List>
                      {orgGuides.map((guide, index) => (
                        <ListItem key={index} component={Link} href={guide.link} sx={{ color: 'inherit', textDecoration: 'none' }}>
                          <ListItemIcon>
                            {guide.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={guide.title} 
                            secondary={guide.description} 
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>

        {/* FAQ Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Frequently Asked Questions
          </Typography>
          {filteredFaqs.map((faq, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* Contact Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Need More Help?
          </Typography>
          <Typography variant="body1" paragraph>
            If you couldn't find the answer to your question, please contact our support team.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            component={Link} 
            href="mailto:support@smartmealplanner.example.com"
          >
            Contact Support
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Support;