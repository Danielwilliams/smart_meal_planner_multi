import React from 'react';
import { Box, Container, Grid, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[100]
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Smart Meal Planner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Simplifying meal planning for a healthier life.
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Links
            </Typography>
            <Typography variant="body2">
              <Link component={RouterLink} to="/" color="inherit">
                Home
              </Link>
            </Typography>
            <Typography variant="body2">
              <Link component={RouterLink} to="/privacy-policy" color="inherit">
                Privacy Policy
              </Link>
            </Typography>
            <Typography variant="body2">
              <Link component={RouterLink} to="/support" color="inherit">
                Support
              </Link>
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Contact
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Email: support@smartmealplanner.com
            </Typography>
          </Grid>
        </Grid>
        <Box mt={3}>
          <Typography variant="body2" color="text.secondary" align="center">
            {'© '}
            {currentYear}
            {' Smart Meal Planner. All rights reserved.'}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;