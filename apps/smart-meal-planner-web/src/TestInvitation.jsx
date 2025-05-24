import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, TextField, Button, Link, Paper, Divider } from '@mui/material';

const TestInvitation = () => {
  const [token, setToken] = useState('test_token_123');
  const [orgId, setOrgId] = useState('1');
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [links, setLinks] = useState({});

  const generateLinks = () => {
    const newLinks = {
      clientSignup: `${baseUrl}/client-signup?token=${token}&org=${orgId}`,
      acceptInvitation: `${baseUrl}/accept-invitation?token=${token}&org=${orgId}`,
      login: `${baseUrl}/login?invitation=true&token=${token}&org=${orgId}`
    };
    setLinks(newLinks);
  };

  useEffect(() => {
    generateLinks();
  }, [token, orgId, baseUrl]);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Test Client Invitation Links
        </Typography>
        <Typography variant="body1" paragraph>
          Use these links to test the client invitation flow. You can customize the token and organization ID.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <TextField
            label="Invitation Token"
            fullWidth
            value={token}
            onChange={(e) => setToken(e.target.value)}
            margin="normal"
          />
          <TextField
            label="Organization ID"
            fullWidth
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            margin="normal"
          />
          <TextField
            label="Base URL"
            fullWidth
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            margin="normal"
          />
          <Button variant="contained" onClick={generateLinks} sx={{ mt: 2 }}>
            Update Links
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h5" gutterBottom>
            Test Links
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">New Client Signup:</Typography>
            <Link href={links.clientSignup} target="_blank" rel="noopener">
              {links.clientSignup}
            </Link>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">Accept Invitation (existing user):</Typography>
            <Link href={links.acceptInvitation} target="_blank" rel="noopener">
              {links.acceptInvitation}
            </Link>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">Login with Invitation:</Typography>
            <Link href={links.login} target="_blank" rel="noopener">
              {links.login}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default TestInvitation;