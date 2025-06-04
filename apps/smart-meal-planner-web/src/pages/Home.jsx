import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Grid, 
  Paper 
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SubscriptionStatusBanner from '../components/SubscriptionStatusBanner';

function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <SubscriptionStatusBanner />
      </Box>
      <Paper elevation={3} sx={{ 
        p: 4, 
        mt: 2, 
        textAlign: 'center', 
        borderRadius: 2 
      }}>
        {/* ... existing content ... */}
        
        <Grid container spacing={2} justifyContent="center">
          {!isAuthenticated ? (
            <>
              <Grid item>
                <Button 
                  variant="contained" 
                  component={Link} 
                  to="/login"
                >
                  Log In
                </Button>
              </Grid>
              <Grid item>
                <Button 
                  variant="outlined" 
                  component={Link} 
                  to="/signup"
                >
                  Sign Up
                </Button>
              </Grid>
            </>
          ) : (
            <Grid item>
              <Button 
                variant="contained" 
                component={Link} 
                to="/menu"
              >
                View Your Menu
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
}

export default Home;