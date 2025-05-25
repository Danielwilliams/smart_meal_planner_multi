// src/components/InactiveClientNotice.jsx
import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  Button
} from '@mui/material';
import {
  ContactSupport as ContactIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const InactiveClientNotice = ({ organizationName, contactEmail }) => {
  const handleContactClick = () => {
    if (contactEmail) {
      window.location.href = `mailto:${contactEmail}?subject=Account Reactivation Request&body=Hello,%0D%0A%0D%0AI would like to request reactivation of my account. Please let me know what steps I need to take.%0D%0A%0D%0AThank you.`;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <WarningIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="warning.main">
            Account Deactivated
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body1">
            Your account has been temporarily deactivated by {organizationName || 'your organization'}. 
            You currently do not have access to meal planning features.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            What does this mean?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            • You cannot access meal plans, recipes, or shopping lists
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            • Your preferences and saved data are preserved
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            • Your account can be reactivated by your organization administrator
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            How to get reactivated:
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please contact your organization administrator to request account reactivation.
          </Typography>
          
          {contactEmail && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ContactIcon />}
              onClick={handleContactClick}
              sx={{ mb: 2 }}
            >
              Contact {organizationName || 'Organization'}
            </Button>
          )}
          
          {contactEmail && (
            <Typography variant="body2" color="text.secondary">
              Email: {contactEmail}
            </Typography>
          )}
        </Box>

        <Alert severity="info" sx={{ textAlign: 'left' }}>
          <Typography variant="body2">
            <strong>Need immediate assistance?</strong><br />
            If you believe this is an error or have questions about your account status, 
            please reach out to your organization administrator as soon as possible.
          </Typography>
        </Alert>
      </Paper>
    </Container>
  );
};

export default InactiveClientNotice;