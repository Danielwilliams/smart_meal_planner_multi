import React from 'react';
import { Container, Typography, Button, Paper, Box } from '@mui/material';

function TestDebugPage() {
  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Debug Test Page
        </Typography>
        <Typography variant="body1" paragraph>
          If you can see this page, routing is working correctly!
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Button 
            variant="contained" 
            color="error"
            size="large"
            onClick={() => alert('Debug button clicked!')}
          >
            Test Debug Button
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default TestDebugPage;