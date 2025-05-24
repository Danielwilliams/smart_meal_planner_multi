import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';

const DebugSharedMenus = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Current user:', user);
      
      // Fetch dashboard data
      const response = await apiService.getClientDashboard();
      console.log('Dashboard response:', response);
      setDashboardData(response);
      
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call debug endpoint for user ID
      const userId = user?.user_id || user?.id;
      if (!userId) {
        throw new Error('No user ID found');
      }
      
      const response = await apiService.axiosInstance.get(`/client-resources/${userId}/menus/debug`);
      console.log('Debug response:', response.data);
      setDebugData(response.data);
      
    } catch (err) {
      console.error('Error fetching debug data:', err);
      setError(err.message || 'Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Debug Shared Menus
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>User Info</Typography>
        <Typography variant="body2">
          User ID: {user?.user_id || user?.id || 'Unknown'}<br />
          Email: {user?.email || 'Unknown'}<br />
          Account Type: {user?.account_type || 'Unknown'}<br />
          Role: {user?.role || 'Unknown'}<br />
          Organization ID: {user?.organization_id || 'None'}
        </Typography>
      </Paper>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant="contained" 
          onClick={fetchDashboardData}
          disabled={loading}
        >
          Fetch Dashboard Data
        </Button>
        <Button 
          variant="contained" 
          color="secondary"
          onClick={fetchDebugData}
          disabled={loading}
        >
          Fetch Debug Data
        </Button>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {dashboardData && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Dashboard Data</Typography>
          <Typography variant="body2" component="pre" sx={{ overflow: 'auto' }}>
            {JSON.stringify(dashboardData, null, 2)}
          </Typography>
        </Paper>
      )}

      {debugData && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Debug Data</Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Client Info:</Typography>
            <Typography variant="body2" component="pre">
              {JSON.stringify(debugData.client_info, null, 2)}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">
              Shared Menus Count: {debugData.shared_menus_count}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Organization Relationships:</Typography>
            {debugData.organization_relationships?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Client ID</TableCell>
                      <TableCell>Org ID</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {debugData.organization_relationships.map((rel, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{rel.client_id}</TableCell>
                        <TableCell>{rel.organization_id}</TableCell>
                        <TableCell>{rel.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="error">
                No organization relationships found!
              </Typography>
            )}
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Shared Menus:</Typography>
            {debugData.shared_menus?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Menu ID</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Org ID</TableCell>
                      <TableCell>Shared At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {debugData.shared_menus.map((menu, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{menu.menu_id}</TableCell>
                        <TableCell>{menu.title || menu.nickname || 'Untitled'}</TableCell>
                        <TableCell>{menu.organization_id}</TableCell>
                        <TableCell>{new Date(menu.shared_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No shared menus found
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default DebugSharedMenus;