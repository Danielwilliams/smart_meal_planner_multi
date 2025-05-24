import React from 'react';
import InstacartTester from '../components/InstacartTester';
import { Container, Typography, Box, Link } from '@mui/material';

const InstacartTestPage = () => {
  return (
    <Container>
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Instacart API Connection Tester
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
          Use this page to test your Instacart API connection directly
        </Typography>
      </Box>

      <InstacartTester />

      <Box sx={{ mt: 4, mb: 8, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          CORS errors are expected when testing directly from a browser. 
          For production use, you should use a proxy or server-side requests.
        </Typography>
        <Link 
          href="https://developer.instacart.com/docs"
          target="_blank" 
          rel="noopener"
          sx={{ display: 'block', mt: 1 }}
        >
          Instacart API Documentation
        </Link>
      </Box>
    </Container>
  );
};

export default InstacartTestPage;