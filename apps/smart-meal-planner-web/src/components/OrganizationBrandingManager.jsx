// src/components/OrganizationBrandingManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, 
  Switch, FormControlLabel, Tabs, Tab, Alert, CircularProgress,
  Card, CardContent, FormControl, InputLabel, Select, MenuItem,
  Chip, Divider, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, ButtonGroup
} from '@mui/material';
import {
  Palette as PaletteIcon,
  ViewModule as LayoutIcon,
  Message as MessageIcon,
  Star as FeaturesIcon,
  Preview as PreviewIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { useBranding } from '../context/BrandingContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`branding-tabpanel-${index}`}
      aria-labelledby={`branding-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const OrganizationBrandingManager = () => {
  const { branding, loadBranding } = useBranding();
  const { organization } = useOrganization();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    visual: {},
    layout: {},
    messaging: {},
    features: {}
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewDialog, setPreviewDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (branding) {
      setFormData({
        visual: branding.visual || {},
        layout: branding.layout || {},
        messaging: branding.messaging || {},
        features: branding.features || {}
      });
    }
  }, [branding]);

  useEffect(() => {
    // Check if there are any changes from the original branding
    if (branding) {
      const hasVisualChanges = JSON.stringify(formData.visual) !== JSON.stringify(branding.visual);
      const hasLayoutChanges = JSON.stringify(formData.layout) !== JSON.stringify(branding.layout);
      const hasMessagingChanges = JSON.stringify(formData.messaging) !== JSON.stringify(branding.messaging);
      const hasFeaturesChanges = JSON.stringify(formData.features) !== JSON.stringify(branding.features);
      
      setHasChanges(hasVisualChanges || hasLayoutChanges || hasMessagingChanges || hasFeaturesChanges);
    }
  }, [formData, branding]);

  const handleSave = async () => {
    if (!organization?.id) {
      setError('Organization not found');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      await apiService.put(`/api/organization-branding/${organization.id}/branding`, formData);
      await loadBranding(); // Reload branding context
      setSuccess('Branding settings saved successfully!');
      setHasChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Error saving branding:', error);
      setError(error.response?.data?.detail || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (branding) {
      setFormData({
        visual: branding.visual || {},
        layout: branding.layout || {},
        messaging: branding.messaging || {},
        features: branding.features || {}
      });
      setHasChanges(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!organization?.id) return;
    
    try {
      setLoading(true);
      await apiService.get(`/api/organization-branding/${organization.id}/branding/reset`);
      await loadBranding();
      setSuccess('Branding reset to defaults successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to reset branding to defaults');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleColorChange = (field, value) => {
    updateFormData('visual', field, value);
  };

  const fontOptions = [
    'Roboto', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
    'Verdana', 'Tahoma', 'Open Sans', 'Lato', 'Montserrat', 
    'Source Sans Pro', 'Nunito', 'Poppins'
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Branding Settings...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom>
              Organization Branding
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Customize your organization's visual identity and messaging for clients
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => setPreviewDialog(true)}
                disabled={!hasChanges}
              >
                Preview
              </Button>
              <Button
                variant="outlined"
                startIcon={<UndoIcon />}
                onClick={handleReset}
                disabled={!hasChanges}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> These settings will apply to all clients and staff in your organization. 
          Individual users will continue to see the default platform styling.
        </Typography>
      </Alert>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<PaletteIcon />} 
            label="Visual Design" 
            iconPosition="start"
          />
          <Tab 
            icon={<LayoutIcon />} 
            label="Layout" 
            iconPosition="start"
          />
          <Tab 
            icon={<MessageIcon />} 
            label="Messaging" 
            iconPosition="start"
          />
          <Tab 
            icon={<FeaturesIcon />} 
            label="Features" 
            iconPosition="start"
          />
        </Tabs>

        {/* Visual Design Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>Colors</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Primary Color"
                      type="color"
                      value={formData.visual?.primaryColor || '#4caf50'}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <Box 
                            sx={{ 
                              width: 20, 
                              height: 20, 
                              backgroundColor: formData.visual?.primaryColor || '#4caf50',
                              borderRadius: 1,
                              mr: 1 
                            }} 
                          />
                        )
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Secondary Color"
                      type="color"
                      value={formData.visual?.secondaryColor || '#ff9800'}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <Box 
                            sx={{ 
                              width: 20, 
                              height: 20, 
                              backgroundColor: formData.visual?.secondaryColor || '#ff9800',
                              borderRadius: 1,
                              mr: 1 
                            }} 
                          />
                        )
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Accent Color"
                      type="color"
                      value={formData.visual?.accentColor || '#2196f3'}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <Box 
                            sx={{ 
                              width: 20, 
                              height: 20, 
                              backgroundColor: formData.visual?.accentColor || '#2196f3',
                              borderRadius: 1,
                              mr: 1 
                            }} 
                          />
                        )
                      }}
                    />
                  </Grid>
                </Grid>
              </Card>

              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Typography</Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Font Family</InputLabel>
                  <Select
                    value={formData.visual?.fontFamily || 'Roboto'}
                    onChange={(e) => updateFormData('visual', 'fontFamily', e.target.value)}
                    label="Font Family"
                  >
                    {fontOptions.map(font => (
                      <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
                        {font}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>Logo & Images</Typography>
                <TextField
                  fullWidth
                  label="Logo URL"
                  value={formData.visual?.logoUrl || ''}
                  onChange={(e) => updateFormData('visual', 'logoUrl', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Upload your logo to a service like AWS S3 or Cloudinary and paste the URL here"
                />
                
                {formData.visual?.logoUrl && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Logo Preview:</Typography>
                    <img
                      src={formData.visual.logoUrl}
                      alt="Logo Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '60px',
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Favicon URL"
                  value={formData.visual?.faviconUrl || ''}
                  onChange={(e) => updateFormData('visual', 'faviconUrl', e.target.value)}
                  helperText="Small icon that appears in browser tabs"
                />
              </Card>

              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Custom CSS</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Custom CSS"
                  value={formData.visual?.customCSS || ''}
                  onChange={(e) => updateFormData('visual', 'customCSS', e.target.value)}
                  helperText="Advanced: Add custom CSS for additional styling"
                  placeholder="/* Add your custom CSS here */"
                />
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Layout Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Layout Preferences</Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Header Style</InputLabel>
                  <Select
                    value={formData.layout?.headerStyle || 'standard'}
                    onChange={(e) => updateFormData('layout', 'headerStyle', e.target.value)}
                    label="Header Style"
                  >
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="minimal">Minimal</MenuItem>
                    <MenuItem value="centered">Centered</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Card Style</InputLabel>
                  <Select
                    value={formData.layout?.cardStyle || 'rounded'}
                    onChange={(e) => updateFormData('layout', 'cardStyle', e.target.value)}
                    label="Card Style"
                  >
                    <MenuItem value="rounded">Rounded</MenuItem>
                    <MenuItem value="square">Square</MenuItem>
                    <MenuItem value="elevated">Elevated</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Button Style</InputLabel>
                  <Select
                    value={formData.layout?.buttonStyle || 'filled'}
                    onChange={(e) => updateFormData('layout', 'buttonStyle', e.target.value)}
                    label="Button Style"
                  >
                    <MenuItem value="filled">Filled</MenuItem>
                    <MenuItem value="outlined">Outlined</MenuItem>
                    <MenuItem value="text">Text</MenuItem>
                  </Select>
                </FormControl>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Layout Preview</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Layout changes will be applied to cards, buttons, and overall page structure.
                </Typography>
                
                {/* Mini preview */}
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Sample Card</Typography>
                  <Box 
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider',
                      borderRadius: formData.layout?.cardStyle === 'square' ? 0 : formData.layout?.cardStyle === 'elevated' ? 2 : 1,
                      boxShadow: formData.layout?.cardStyle === 'elevated' ? 2 : 0,
                      p: 1,
                      mb: 2
                    }}
                  >
                    <Typography variant="body2">Sample content</Typography>
                  </Box>
                  
                  <Button 
                    variant={formData.layout?.buttonStyle === 'outlined' ? 'outlined' : formData.layout?.buttonStyle === 'text' ? 'text' : 'contained'}
                    size="small"
                  >
                    Sample Button
                  </Button>
                </Box>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Messaging Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Platform Identity</Typography>
                
                <TextField
                  fullWidth
                  label="Platform Name"
                  value={formData.messaging?.platformName || ''}
                  onChange={(e) => updateFormData('messaging', 'platformName', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="This will replace 'Smart Meal Planner' in your client-facing interface"
                  placeholder="Your Organization Name"
                />
                
                <TextField
                  fullWidth
                  label="Tagline"
                  value={formData.messaging?.tagline || ''}
                  onChange={(e) => updateFormData('messaging', 'tagline', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="A short phrase that describes your mission"
                  placeholder="Personalized Nutrition for Better Health"
                />
                
                <TextField
                  fullWidth
                  label="Footer Text"
                  value={formData.messaging?.footerText || ''}
                  onChange={(e) => updateFormData('messaging', 'footerText', e.target.value)}
                  helperText="Copyright or contact information"
                  placeholder="© 2024 Your Organization Name"
                />
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Contact Information</Typography>
                
                <TextField
                  fullWidth
                  label="Support Email"
                  type="email"
                  value={formData.messaging?.supportEmail || ''}
                  onChange={(e) => updateFormData('messaging', 'supportEmail', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Email address for client support"
                  placeholder="support@yourorganization.com"
                />
                
                <TextField
                  fullWidth
                  label="Support Phone"
                  value={formData.messaging?.supportPhone || ''}
                  onChange={(e) => updateFormData('messaging', 'supportPhone', e.target.value)}
                  helperText="Phone number for client support"
                  placeholder="(555) 123-4567"
                />
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Features Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Branding Features</Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.features?.showPoweredBy !== false}
                      onChange={(e) => updateFormData('features', 'showPoweredBy', e.target.checked)}
                    />
                  }
                  label="Show 'Powered by Smart Meal Planner'"
                  sx={{ mb: 2, display: 'block' }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Display attribution to Smart Meal Planner platform
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.features?.hideDefaultLogo || false}
                      onChange={(e) => updateFormData('features', 'hideDefaultLogo', e.target.checked)}
                    />
                  }
                  label="Hide Default Logo When Custom Logo is Set"
                  sx={{ mb: 2, display: 'block' }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Only show your custom logo, hide the default platform icon
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Advanced Features</Typography>
                
                <TextField
                  fullWidth
                  label="Custom Domain"
                  value={formData.features?.customDomain || ''}
                  onChange={(e) => updateFormData('features', 'customDomain', e.target.value)}
                  helperText="Future feature: Custom domain for your branded platform"
                  placeholder="nutrition.yourorganization.com"
                  disabled
                />
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  <strong>Coming Soon:</strong> Custom domains, white-label mobile apps, and API integrations.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Action Buttons */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Button
          variant="outlined"
          color="error"
          onClick={handleResetToDefaults}
          startIcon={<RefreshIcon />}
        >
          Reset to Defaults
        </Button>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!hasChanges}
            startIcon={<UndoIcon />}
          >
            Cancel Changes
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save Branding'}
          </Button>
        </Box>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Branding Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This shows how your branding will appear to clients. Save your changes to see them live.
          </Typography>
          
          {/* Preview content would go here */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              {formData.messaging?.platformName || 'Smart Meal Planner'}
            </Typography>
            {formData.messaging?.tagline && (
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {formData.messaging.tagline}
              </Typography>
            )}
            <Typography variant="body2">
              This is how your platform will appear to clients with the selected branding settings.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close Preview</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationBrandingManager;