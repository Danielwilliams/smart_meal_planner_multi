import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  TextField,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Assignment as FormIcon,
  Check as CheckIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';
import apiService from '../services/apiService';

const OnboardingResponseViewer = ({ organizationId }) => {
  const [forms, setForms] = useState([]);
  const [responses, setResponses] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load all forms, responses, and clients in parallel
      const [formsData, responsesData, clientsData] = await Promise.all([
        apiService.getOnboardingForms(organizationId),
        apiService.getFormResponses(organizationId),
        apiService.getOrganizationClients(organizationId)
      ]);

      setForms(formsData || []);
      setResponses(responsesData || []);
      setClients(clientsData || []);
    } catch (err) {
      console.error('Error loading onboarding data:', err);
      setError('Failed to load onboarding forms and responses');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResponse = (response) => {
    setSelectedResponse(response);
    setNotes(response.notes || '');
    setDetailDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedResponse(null);
    setNotes('');
  };

  const handleSaveNotes = async () => {
    if (!selectedResponse) return;

    try {
      setSavingNotes(true);
      await apiService.updateResponseNotes(selectedResponse.id, notes);
      
      // Update the local state
      setResponses(prev => 
        prev.map(r => 
          r.id === selectedResponse.id 
            ? { ...r, notes: notes }
            : r
        )
      );
      
      setSelectedResponse(prev => ({ ...prev, notes: notes }));
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : `Client ${clientId}`;
  };

  const getFormName = (formId) => {
    const form = forms.find(f => f.id === formId);
    return form ? form.name : `Form ${formId}`;
  };

  const renderResponseValue = (value) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value || '');
  };

  const getResponseSummary = () => {
    const totalResponses = responses.length;
    const completedResponses = responses.filter(r => r.status === 'completed').length;
    const pendingResponses = responses.filter(r => r.status === 'draft').length;

    return { totalResponses, completedResponses, pendingResponses };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  const { totalResponses, completedResponses, pendingResponses } = getResponseSummary();

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <FormIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {forms.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Forms
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {completedResponses}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed Responses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PendingIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {pendingResponses}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Responses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Responses by Form */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Client Responses
        </Typography>

        {forms.length === 0 ? (
          <Alert severity="info">
            No onboarding forms have been created yet. Create a form to start collecting client responses.
          </Alert>
        ) : totalResponses === 0 ? (
          <Alert severity="info">
            No client responses received yet. Responses will appear here once clients complete your onboarding forms.
          </Alert>
        ) : (
          <Box>
            {forms.map(form => {
              const formResponses = responses.filter(r => r.form_id === form.id);
              
              return (
                <Accordion key={form.id} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6">
                        {form.name}
                      </Typography>
                      <Chip 
                        label={`${formResponses.length} responses`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {formResponses.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No responses for this form yet.
                      </Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Client</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Completed</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {formResponses.map(response => (
                              <TableRow key={response.id}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PersonIcon fontSize="small" />
                                    {getClientName(response.client_id)}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={response.status}
                                    size="small"
                                    color={response.status === 'completed' ? 'success' : 'warning'}
                                  />
                                </TableCell>
                                <TableCell>
                                  {response.completed_at 
                                    ? new Date(response.completed_at).toLocaleDateString()
                                    : 'Not completed'
                                  }
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="View Response Details">
                                    <IconButton 
                                      size="small"
                                      onClick={() => handleViewResponse(response)}
                                    >
                                      <ViewIcon />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Response Detail Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Response Details
        </DialogTitle>
        <DialogContent dividers>
          {selectedResponse && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Client
                  </Typography>
                  <Typography variant="body1">
                    {getClientName(selectedResponse.client_id)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Form
                  </Typography>
                  <Typography variant="body1">
                    {getFormName(selectedResponse.form_id)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedResponse.status}
                    size="small"
                    color={selectedResponse.status === 'completed' ? 'success' : 'warning'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Completed
                  </Typography>
                  <Typography variant="body1">
                    {selectedResponse.completed_at 
                      ? new Date(selectedResponse.completed_at).toLocaleString()
                      : 'Not completed'
                    }
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Responses
              </Typography>
              
              {selectedResponse.response_data && Object.keys(selectedResponse.response_data).length > 0 ? (
                <Box sx={{ mb: 3 }}>
                  {Object.entries(selectedResponse.response_data).map(([fieldId, value]) => (
                    <Box key={fieldId} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {fieldId}
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>
                        {renderResponseValue(value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  No response data available.
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this client's response..."
                variant="outlined"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Close
          </Button>
          <Button
            onClick={handleSaveNotes}
            variant="contained"
            disabled={savingNotes}
            startIcon={savingNotes ? <CircularProgress size={16} /> : <EditIcon />}
          >
            {savingNotes ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OnboardingResponseViewer;