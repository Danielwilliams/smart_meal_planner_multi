import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Divider
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';

const SubscriptionCancelPage = () => {
  const navigate = useNavigate();
  
  const handleReturnToPlans = () => {
    navigate('/subscription');
  };
  
  const handleReturnToHome = () => {
    navigate('/home');
  };
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <CancelIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
        
        <Typography variant="h4" component="h1" gutterBottom>
          Subscription Canceled
        </Typography>
        
        <Typography variant="body1" paragraph>
          You've canceled the subscription process. No charges have been made to your account.
        </Typography>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="body1" paragraph>
          You can subscribe at any time to access all premium features.
        </Typography>
        
        <Box sx={{ mt: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleReturnToPlans}
          >
            View Plans Again
          </Button>
          
          <Button 
            variant="outlined"
            onClick={handleReturnToHome}
          >
            Return to Dashboard
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SubscriptionCancelPage;