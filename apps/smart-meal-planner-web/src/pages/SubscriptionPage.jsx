import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import subscriptionService from '../services/subscriptionService';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';

const SubscriptionPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        const subscriptionData = await subscriptionService.getSubscriptionStatus();
        setSubscription(subscriptionData);
        
        // Fetch invoices if user has an active subscription
        if (subscriptionData && subscriptionData.status === 'active') {
          const invoicesData = await subscriptionService.getInvoices();
          setInvoices(invoicesData || []);
        }
      } catch (err) {
        console.error('Error fetching subscription data:', err);
        setError('Failed to load subscription information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, [isAuthenticated, navigate]);
  
  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Clear messages when switching tabs
    setError(null);
    setSuccessMessage(null);
  };
  
  const handleSubscribe = async (subscriptionType) => {
    try {
      setLoading(true);
      
      // Define success and cancel URLs
      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/subscription/cancel`;
      
      const response = await subscriptionService.createCheckoutSession(
        subscriptionType,
        'stripe', // Default to Stripe for now
        successUrl,
        cancelUrl
      );
      
      // Redirect to Stripe checkout
      if (response && response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError('An error occurred while processing your subscription request.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      setSuccessMessage(null); // Clear any previous success messages
      
      const response = await subscriptionService.cancelSubscription(true); // Cancel at period end
      
      // Display the success message from the backend
      if (response && response.message) {
        setSuccessMessage(response.message);
      } else {
        setSuccessMessage('Your subscription has been successfully canceled.');
      }
      
      // Refresh subscription data
      const subscriptionData = await subscriptionService.getSubscriptionStatus();
      setSubscription(subscriptionData);
      
      setOpenCancelDialog(false);
    } catch (err) {
      console.error('Cancel subscription error:', err);
      setError('Failed to cancel subscription. Please try again later.');
      setSuccessMessage(null); // Clear success message on error
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading subscription information...
        </Typography>
      </Container>
    );
  }
  
  const renderSubscriptionPlans = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Choose a Subscription Plan
      </Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Individual Plan */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Individual Plan
              </Typography>
              <Typography variant="h4" component="p" color="primary" gutterBottom>
                $7.99<Typography variant="caption" component="span">/month</Typography>
              </Typography>
              <Divider sx={{ my: 2 }} />
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Personalized meal plans" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Smart shopping lists" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Grocery delivery integration" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Unlimited meal generations" />
                </ListItem>
              </List>
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                onClick={() => handleSubscribe('individual')}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Subscribe Now'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Organization Plan */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column', 
            borderColor: 'secondary.main', borderWidth: 2, borderStyle: 'solid' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Organization Plan
              </Typography>
              <Typography variant="h4" component="p" color="secondary" gutterBottom>
                $49.99<Typography variant="caption" component="span">/month</Typography>
              </Typography>
              <Divider sx={{ my: 2 }} />
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="All Individual Plan features" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Manage up to 50 clients" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Custom branding options" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Client preference management" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Organization recipe library" />
                </ListItem>
              </List>
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
              <Button 
                variant="contained" 
                color="secondary"
                size="large"
                onClick={() => handleSubscribe('organization')}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Subscribe Now'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
  
  const renderCurrentSubscription = () => (
    <Box sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Current Subscription
        </Typography>
        
        {subscription?.status === 'active' && (
          <>
            <Box sx={{ my: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="body1" color="textPrimary">
                <strong>Status:</strong> Active
              </Typography>
            </Box>
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  <strong>Plan:</strong> {subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  <strong>Price:</strong> ${subscription.monthly_amount}/{subscription.currency.toLowerCase()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  <strong>Billing Period:</strong> Monthly
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  <strong>Next Billing Date:</strong> {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}
                </Typography>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                color="error"
                onClick={() => setOpenCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            </Box>
          </>
        )}
        
        {subscription?.status === 'canceled' && (
          <>
            <Box sx={{ my: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="body1" color="textPrimary">
                <strong>Status:</strong> Canceled (Access until {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'})
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              Your subscription has been canceled but you still have access until the end of your current billing period.
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => handleSubscribe(subscription.subscription_type)}
              >
                Reactivate Subscription
              </Button>
            </Box>
          </>
        )}
        
        {subscription?.status === 'free_tier' && (
          <>
            <Box sx={{ my: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body1" color="textPrimary">
                <strong>Status:</strong> Free Trial
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              You are currently on the free trial plan. Upgrade to a paid plan to access all features.
            </Typography>
            
            {subscription.beta_expiration_date && (
              <Typography variant="body2" color="textSecondary" paragraph>
                Your free trial expires on {new Date(subscription.beta_expiration_date).toLocaleDateString()}.
              </Typography>
            )}
            
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => setActiveTab(0)}
              >
                View Subscription Plans
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
  
  const renderBillingHistory = () => (
    <Box sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Billing History
        </Typography>
        
        {!invoices || invoices.length === 0 ? (
          <Typography variant="body1" color="textSecondary">
            No billing history available.
          </Typography>
        ) : (
          <List>
            {invoices.map((invoice) => {
              // Safely handle potential null/undefined values
              const invoiceDate = invoice.created 
                ? new Date(invoice.created * 1000).toLocaleDateString() // Stripe timestamps are in seconds
                : 'Unknown';
              
              const amount = invoice.amount_paid 
                ? (invoice.amount_paid / 100).toFixed(2) // Stripe amounts are in cents
                : '0.00';
              
              const status = invoice.status || 'unknown';
              const statusColor = status === 'paid' ? 'success.main' : 'error.main';
              
              return (
                <ListItem key={invoice.id || Math.random()} divider>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2" color="textSecondary">
                        {invoiceDate}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2">
                        ${amount}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2" color={statusColor}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      {invoice.hosted_invoice_url && (
                        <Button 
                          variant="outlined" 
                          size="small"
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Invoice
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>
    </Box>
  );
  
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Subscription Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Plans" />
          <Tab label="Current Subscription" />
          <Tab label="Billing History" />
        </Tabs>
      </Paper>
      
      {activeTab === 0 && renderSubscriptionPlans()}
      {activeTab === 1 && renderCurrentSubscription()}
      {activeTab === 2 && renderBillingHistory()}
      
      {/* Cancel Subscription Dialog */}
      <Dialog
        open={openCancelDialog}
        onClose={() => setOpenCancelDialog(false)}
      >
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelDialog(false)} color="primary">
            No, Keep My Subscription
          </Button>
          <Button onClick={handleCancelSubscription} color="error" variant="contained">
            Yes, Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubscriptionPage;