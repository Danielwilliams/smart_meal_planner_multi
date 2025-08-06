// src/pages/OrganizationSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tab,
  Tabs,
  Alert,
  Button,
  CircularProgress,
  TextField,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';
import PreferencesForm from '../components/PreferencesForm';
import MenuDefaultsSettings from '../components/MenuDefaultsSettings';
import OrganizationBrandingManager from '../components/OrganizationBrandingManager';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Organization settings state
  const [orgSettings, setOrgSettings] = useState(null);
  
  // Default client preferences state (using same structure as individual preferences)
  const [defaultPreferences, setDefaultPreferences] = useState({
    servingsPerMeal: 1,
    appliances: {
      airFryer: false,
      instapot: false,
      crockpot: false
    },
    prepComplexity: 50,
    dietTypes: {
      Vegetarian: false,
      Vegan: false,
      Pescatarian: false,
      Mediterranean: false,
      Ketogenic: false,
      Paleo: false,
      'Low-Carb': false,
      'Low-Fat': false,
      'Low-Sodium': false,
      'Gluten-Free': false,
      'Dairy-Free': false,
      Other: false
    },
    otherDietType: '',
    dietaryRestrictions: '',
    dislikedIngredients: '',
    recipeTypes: {
      American: false,
      Italian: false,
      Mexican: false,
      Asian: false,
      Mediterranean: false,
      Indian: false,
      French: false,
      Greek: false,
      Japanese: false,
      Thai: false,
      Chinese: false,
      Korean: false,
      Spanish: false,
      'Middle Eastern': false,
      Vietnamese: false,
      Brazilian: false,
      Caribbean: false,
      Other: false
    },
    otherRecipeType: '',
    mealTimes: {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: false
    },
    snacksPerDay: 1,
    macroGoals: {
      protein: '',
      carbs: '',
      fat: '',
      calories: ''
    },
    krogerUsername: '',
    krogerPassword: ''
  });

  // Enhanced preferences states
  const [flavorPreferences, setFlavorPreferences] = useState({
    creamy: false,
    cheesy: false,
    herbs: false,
    umami: false,
    sweet: false,
    spiced: false,
    smoky: false,
    garlicky: false,
    tangy: false,
    peppery: false,
    hearty: false,
    spicy: false
  });

  const [spiceLevel, setSpiceLevel] = useState('medium');
  const [recipeTypePreferences, setRecipeTypePreferences] = useState({
    'stir-fry': false,
    'grain-bowl': false,
    'salad': false,
    'pasta': false,
    'main-sides': false,
    'pizza': false,
    'burger': false,
    'sandwich': false,
    'tacos': false,
    'wrap': false,
    'soup-stew': false,
    'bake': false,
    'family-meals': false
  });

  const [mealTimePreferences, setMealTimePreferences] = useState({
    'breakfast': false,
    'morning-snack': false,
    'lunch': false,
    'afternoon-snack': false,
    'dinner': false,
    'evening-snack': false
  });

  const [timeConstraints, setTimeConstraints] = useState({
    'weekday-breakfast': 10,
    'weekday-lunch': 15,
    'weekday-dinner': 30,
    'weekend-breakfast': 20,
    'weekend-lunch': 30,
    'weekend-dinner': 45
  });

  const [prepPreferences, setPrepPreferences] = useState({
    'batch-cooking': false,
    'meal-prep': false,
    'quick-assembly': false,
    'one-pot': false,
    'minimal-dishes': false
  });

  const [preferredProteins, setPreferredProteins] = useState({
    meat: {
      chicken: false,
      beef: false,
      pork: false,
      turkey: false,
      lamb: false,
      bison: false,
      other: false
    },
    seafood: {
      salmon: false,
      tuna: false,
      cod: false,
      shrimp: false,
      crab: false,
      mussels: false,
      other: false
    },
    vegetarian_vegan: {
      tofu: false,
      tempeh: false,
      seitan: false,
      lentils: false,
      chickpeas: false,
      black_beans: false,
      other: false
    },
    other: {
      eggs: false,
      dairy_milk: false,
      dairy_yogurt: false,
      protein_powder_whey: false,
      protein_powder_pea: false,
      quinoa: false,
      other: false
    }
  });

  const [otherProteins, setOtherProteins] = useState({
    meat: '',
    seafood: '',
    vegetarian_vegan: '',
    other: ''
  });

  // Carb cycling preferences state for organization defaults
  const [carbCyclingEnabled, setCarbCyclingEnabled] = useState(false);
  
  const [carbCyclingConfig, setCarbCyclingConfig] = useState({
    pattern: '3-1-3',
    high_carb_grams: 200,
    moderate_carb_grams: 100,
    low_carb_grams: 50,
    no_carb_grams: 20,
    weekly_schedule: {
      monday: 'high',
      tuesday: 'low',
      wednesday: 'high',
      thursday: 'moderate',
      friday: 'high',
      saturday: 'low',
      sunday: 'low'
    },
    sync_with_workouts: false,
    workout_days: [],
    custom_pattern: false,
    goals: {
      primary: 'fat_loss',
      secondary: 'maintain_muscle'
    },
    notes: ''
  });

  useEffect(() => {
    if (organization?.id) {
      loadOrganizationSettings();
    }
  }, [organization]);

  const loadOrganizationSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const settings = await apiService.getOrganizationSettings(organization.id);
      setOrgSettings(settings);
      
      // Load default client preferences if they exist
      if (settings.default_client_preferences && Object.keys(settings.default_client_preferences).length > 0) {
        const defaults = settings.default_client_preferences;
        
        setDefaultPreferences(prev => ({
          ...prev,
          ...defaults
        }));
        
        if (defaults.flavorPreferences) setFlavorPreferences(defaults.flavorPreferences);
        if (defaults.spiceLevel) setSpiceLevel(defaults.spiceLevel);
        if (defaults.recipeTypePreferences) setRecipeTypePreferences(defaults.recipeTypePreferences);
        if (defaults.mealTimePreferences) setMealTimePreferences(defaults.mealTimePreferences);
        if (defaults.timeConstraints) setTimeConstraints(defaults.timeConstraints);
        if (defaults.prepPreferences) setPrepPreferences(defaults.prepPreferences);
        if (defaults.preferredProteins) setPreferredProteins(defaults.preferredProteins);
        if (defaults.otherProteins) setOtherProteins(defaults.otherProteins);
        
        // Load carb cycling defaults with null checking
        if (defaults.carb_cycling_enabled !== undefined) setCarbCyclingEnabled(defaults.carb_cycling_enabled);
        if (defaults.carb_cycling_config && typeof defaults.carb_cycling_config === 'object' && Object.keys(defaults.carb_cycling_config).length > 0) {
          setCarbCyclingConfig(prev => ({ ...prev, ...defaults.carb_cycling_config }));
        }
      }
      
    } catch (err) {
      console.error('Error loading organization settings:', err);
      setError('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSaveDefaultPreferences = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const preferencesToSave = {
        default_client_preferences: {
          ...defaultPreferences,
          flavorPreferences,
          spiceLevel,
          recipeTypePreferences,
          mealTimePreferences,
          timeConstraints,
          prepPreferences,
          preferredProteins,
          otherProteins,
          // Include carb cycling preferences
          carb_cycling_enabled: carbCyclingEnabled,
          carb_cycling_config: carbCyclingConfig
        }
      };

      await apiService.updateOrganizationSettings(organization.id, preferencesToSave);
      setMessage('Default client preferences saved successfully!');
      
    } catch (err) {
      console.error('Error saving default preferences:', err);
      setError('Failed to save default preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrganizationInfo = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const updates = {
        business_type: orgSettings.business_type,
        service_area: orgSettings.service_area,
        contact_email: orgSettings.contact_email,
        contact_phone: orgSettings.contact_phone,
        website_url: orgSettings.website_url,
        max_client_capacity: orgSettings.max_client_capacity,
        invitation_approval_required: orgSettings.invitation_approval_required,
        auto_assign_default_preferences: orgSettings.auto_assign_default_preferences
      };

      const updatedSettings = await apiService.updateOrganizationSettings(organization.id, updates);
      setOrgSettings(updatedSettings);
      setMessage('Organization settings saved successfully!');
      
    } catch (err) {
      console.error('Error saving organization settings:', err);
      setError('Failed to save organization settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!organization) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">
          You need to be an organization owner to access these settings.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ mt: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Default Client Preferences" />
            <Tab label="Organization Info" />
            <Tab label="Client Management" />
            <Tab label="Menu Defaults" />
            <Tab label="Branding" />
          </Tabs>
        </Box>

        {message && (
          <Alert severity="success" sx={{ m: 2 }}>
            {message}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom>
            Default Client Preferences Template
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set default preferences that will be automatically applied to new clients when they join your organization. 
            Clients can modify these preferences after they're applied.
          </Typography>

          <PreferencesForm
            preferences={defaultPreferences}
            setPreferences={setDefaultPreferences}
            flavorPreferences={flavorPreferences}
            setFlavorPreferences={setFlavorPreferences}
            spiceLevel={spiceLevel}
            setSpiceLevel={setSpiceLevel}
            recipeTypePreferences={recipeTypePreferences}
            setRecipeTypePreferences={setRecipeTypePreferences}
            mealTimePreferences={mealTimePreferences}
            setMealTimePreferences={setMealTimePreferences}
            timeConstraints={timeConstraints}
            setTimeConstraints={setTimeConstraints}
            prepPreferences={prepPreferences}
            setPrepPreferences={setPrepPreferences}
            preferredProteins={preferredProteins}
            setPreferredProteins={setPreferredProteins}
            otherProteins={otherProteins}
            setOtherProteins={setOtherProteins}
            carbCyclingEnabled={carbCyclingEnabled}
            setCarbCyclingEnabled={setCarbCyclingEnabled}
            carbCyclingConfig={carbCyclingConfig}
            setCarbCyclingConfig={setCarbCyclingConfig}
            loading={saving}
            message=""
            error=""
            onSubmit={handleSaveDefaultPreferences}
            submitButtonText="Save Default Client Preferences"
            title=""
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom>
            Organization Information
          </Typography>
          
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Business Type"
              value={orgSettings?.business_type || ''}
              onChange={(e) => setOrgSettings(prev => ({ ...prev, business_type: e.target.value }))}
              margin="normal"
              helperText="e.g., Nutritionist Practice, Meal Prep Service, Corporate Wellness"
            />

            <TextField
              fullWidth
              label="Service Area"
              value={orgSettings?.service_area || ''}
              onChange={(e) => setOrgSettings(prev => ({ ...prev, service_area: e.target.value }))}
              margin="normal"
              multiline
              rows={2}
              helperText="Geographic regions or delivery zones you serve"
            />

            <TextField
              fullWidth
              label="Contact Email"
              type="email"
              value={orgSettings?.contact_email || ''}
              onChange={(e) => setOrgSettings(prev => ({ ...prev, contact_email: e.target.value }))}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Contact Phone"
              value={orgSettings?.contact_phone || ''}
              onChange={(e) => setOrgSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Website URL"
              value={orgSettings?.website_url || ''}
              onChange={(e) => setOrgSettings(prev => ({ ...prev, website_url: e.target.value }))}
              margin="normal"
            />

            <Button
              variant="contained"
              onClick={handleSaveOrganizationInfo}
              disabled={saving}
              sx={{ mt: 2 }}
            >
              {saving ? <CircularProgress size={20} /> : 'Save Organization Info'}
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom>
            Client Management Settings
          </Typography>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              type="number"
              label="Maximum Client Capacity"
              value={orgSettings?.max_client_capacity || ''}
              onChange={(e) => setOrgSettings(prev => ({ 
                ...prev, 
                max_client_capacity: e.target.value ? parseInt(e.target.value) : null 
              }))}
              margin="normal"
              helperText="Leave empty for unlimited clients"
              InputProps={{ inputProps: { min: 1 } }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={orgSettings?.invitation_approval_required || false}
                  onChange={(e) => setOrgSettings(prev => ({ 
                    ...prev, 
                    invitation_approval_required: e.target.checked 
                  }))}
                />
              }
              label="Require approval for new client invitations"
              sx={{ mt: 2, display: 'block' }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={orgSettings?.auto_assign_default_preferences || true}
                  onChange={(e) => setOrgSettings(prev => ({ 
                    ...prev, 
                    auto_assign_default_preferences: e.target.checked 
                  }))}
                />
              }
              label="Automatically apply default preferences to new clients"
              sx={{ mt: 1, display: 'block' }}
            />

            <Button
              variant="contained"
              onClick={handleSaveOrganizationInfo}
              disabled={saving}
              sx={{ mt: 3 }}
            >
              {saving ? <CircularProgress size={20} /> : 'Save Client Management Settings'}
            </Button>
          </Box>
        </TabPanel>

        {/* Menu Defaults Tab */}
        <TabPanel value={tabValue} index={3}>
          <MenuDefaultsSettings organizationId={organization?.id} />
        </TabPanel>

        {/* Branding Tab */}
        <TabPanel value={tabValue} index={4}>
          <OrganizationBrandingManager />
        </TabPanel>
      </Paper>
    </Container>
  );
}