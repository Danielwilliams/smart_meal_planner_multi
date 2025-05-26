// src/components/OnboardingFormBuilder.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Grid,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DragIndicator as DragIcon,
  TextFields as TextIcon,
  ShortText as ShortTextIcon,
  CheckBox as CheckboxIcon,
  RadioButtonChecked as RadioIcon,
  ArrowDropDown as SelectIcon,
  Email as EmailIcon,
  Numbers as NumberIcon,
  DateRange as DateIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: <ShortTextIcon /> },
  { value: 'textarea', label: 'Long Text', icon: <TextIcon /> },
  { value: 'email', label: 'Email', icon: <EmailIcon /> },
  { value: 'number', label: 'Number', icon: <NumberIcon /> },
  { value: 'date', label: 'Date', icon: <DateIcon /> },
  { value: 'select', label: 'Dropdown', icon: <SelectIcon /> },
  { value: 'radio', label: 'Radio Buttons', icon: <RadioIcon /> },
  { value: 'checkbox', label: 'Checkboxes', icon: <CheckboxIcon /> }
];

const OnboardingFormBuilder = ({ organizationId, onSave, onCancel, editingForm = null, onFormCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    is_required: false,
    form_fields: [],
    settings: {}
  });

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentField, setCurrentField] = useState({
    id: '',
    type: 'text',
    label: '',
    placeholder: '',
    required: false,
    options: [],
    validation: {},
    help_text: ''
  });

  // Load form data when editing
  useEffect(() => {
    if (editingForm) {
      setFormData({
        name: editingForm.name,
        description: editingForm.description || '',
        is_active: editingForm.is_active,
        is_required: editingForm.is_required,
        form_fields: editingForm.form_fields || [],
        settings: editingForm.settings || {}
      });
    }
  }, [editingForm]);

  const generateFieldId = () => {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const openFieldDialog = (field = null) => {
    if (field) {
      setCurrentField(field);
      setEditingField(field);
    } else {
      setCurrentField({
        id: generateFieldId(),
        type: 'text',
        label: '',
        placeholder: '',
        required: false,
        options: [],
        validation: {},
        help_text: ''
      });
      setEditingField(null);
    }
    setFieldDialogOpen(true);
  };

  const closeFieldDialog = () => {
    setFieldDialogOpen(false);
    setEditingField(null);
    setCurrentField({
      id: '',
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      options: [],
      validation: {},
      help_text: ''
    });
  };

  const saveField = () => {
    if (!currentField.label.trim()) {
      alert('Please enter a field label');
      return;
    }

    const newFields = [...formData.form_fields];
    
    if (editingField) {
      // Update existing field
      const index = newFields.findIndex(f => f.id === editingField.id);
      if (index !== -1) {
        newFields[index] = { ...currentField };
      }
    } else {
      // Add new field
      newFields.push({ ...currentField });
    }

    setFormData(prev => ({
      ...prev,
      form_fields: newFields
    }));

    closeFieldDialog();
  };

  const deleteField = (fieldId) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      setFormData(prev => ({
        ...prev,
        form_fields: prev.form_fields.filter(f => f.id !== fieldId)
      }));
    }
  };

  const moveField = (fromIndex, toIndex) => {
    const newFields = [...formData.form_fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    
    setFormData(prev => ({
      ...prev,
      form_fields: newFields
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a form name');
      return;
    }

    if (formData.form_fields.length === 0) {
      alert('Please add at least one field to the form');
      return;
    }

    try {
      if (onSave) {
        // If parent component provides save handler, use it
        await onSave(formData);
      } else {
        // Handle save internally using API service
        const apiService = await import('../services/apiService');
        if (editingForm) {
          await apiService.default.updateOnboardingForm(organizationId, editingForm.id, formData);
        } else {
          await apiService.default.createOnboardingForm(organizationId, formData);
        }
        
        // Notify parent that form was created/updated
        if (onFormCreated) {
          onFormCreated();
        }
        
        // Reset form for new form creation
        if (!editingForm) {
          setFormData({
            name: '',
            description: '',
            is_active: true,
            is_required: false,
            form_fields: [],
            settings: {}
          });
          setPreviewMode(false);
        }
        
        alert(editingForm ? 'Form updated successfully!' : 'Form created successfully!');
      }
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to save form. Please try again.');
    }
  };

  const addOption = () => {
    setCurrentField(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const updateOption = (index, value) => {
    const newOptions = [...currentField.options];
    newOptions[index] = value;
    setCurrentField(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const removeOption = (index) => {
    setCurrentField(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const renderFieldPreview = (field) => {
    const commonProps = {
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      helperText: field.help_text,
      fullWidth: true,
      margin: "normal"
    };

    switch (field.type) {
      case 'text':
      case 'email':
        return <TextField {...commonProps} type={field.type} />;
      
      case 'textarea':
        return <TextField {...commonProps} multiline rows={3} />;
      
      case 'number':
        return <TextField {...commonProps} type="number" />;
      
      case 'date':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={field.label}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: "normal",
                  required: field.required,
                  helperText: field.help_text,
                  placeholder: field.placeholder
                }
              }}
            />
          </LocalizationProvider>
        );
      
      case 'select':
        return (
          <FormControl fullWidth margin="normal" required={field.required}>
            <InputLabel>{field.label}</InputLabel>
            <Select label={field.label}>
              {field.options?.map((option, index) => (
                <MenuItem key={index} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'radio':
        return (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {field.label} {field.required && '*'}
            </Typography>
            {field.options?.map((option, index) => (
              <FormControlLabel
                key={index}
                control={<input type="radio" name={field.id} />}
                label={option}
                sx={{ display: 'block' }}
              />
            ))}
          </Box>
        );
      
      case 'checkbox':
        return (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {field.label} {field.required && '*'}
            </Typography>
            {field.options?.map((option, index) => (
              <FormControlLabel
                key={index}
                control={<Checkbox />}
                label={option}
                sx={{ display: 'block' }}
              />
            ))}
          </Box>
        );
      
      default:
        return <TextField {...commonProps} />;
    }
  };

  if (previewMode) {
    return (
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">Preview: {formData.name}</Typography>
            <Button
              variant="outlined"
              onClick={() => setPreviewMode(false)}
              startIcon={<EditIcon />}
            >
              Back to Edit
            </Button>
          </Box>
          
          {formData.description && (
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              {formData.description}
            </Typography>
          )}

          <Box component="form">
            {formData.form_fields.map((field) => (
              <Box key={field.id}>
                {renderFieldPreview(field)}
              </Box>
            ))}
            
            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button variant="contained" disabled>
                Submit Form (Preview)
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {editingForm ? 'Edit' : 'Create'} Onboarding Form
        </Typography>

        {/* Form Settings */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Form Settings</Typography>
            
            <TextField
              fullWidth
              label="Form Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              multiline
              rows={2}
              placeholder="Brief description of what this form is for..."
            />

            <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                }
                label="Active"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                  />
                }
                label="Required for all new clients"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Form Fields */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Form Fields</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openFieldDialog()}
              >
                Add Field
              </Button>
            </Box>

            {formData.form_fields.length === 0 ? (
              <Alert severity="info">
                No fields added yet. Click "Add Field" to start building your form.
              </Alert>
            ) : (
              <List>
                {formData.form_fields.map((field, index) => (
                  <ListItem key={field.id} divider>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <DragIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {FIELD_TYPES.find(t => t.value === field.type)?.icon}
                            <Typography variant="subtitle1">{field.label}</Typography>
                            {field.required && <Chip label="Required" size="small" color="error" />}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            Type: {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                            {field.help_text && ` • ${field.help_text}`}
                          </Typography>
                        }
                      />
                    </Box>
                    
                    <ListItemSecondaryAction>
                      <IconButton onClick={() => openFieldDialog(field)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => deleteField(field.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onCancel}
            >
              Cancel
            </Button>
            
            {formData.form_fields.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => setPreviewMode(true)}
              >
                Preview Form
              </Button>
            )}
          </Box>
          
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!formData.name.trim() || formData.form_fields.length === 0}
          >
            {editingForm ? 'Update' : 'Create'} Form
          </Button>
        </Box>

        {/* Field Editor Dialog */}
        <Dialog open={fieldDialogOpen} onClose={closeFieldDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingField ? 'Edit' : 'Add'} Form Field
          </DialogTitle>
          
          <DialogContent>
            <TextField
              fullWidth
              label="Field Label"
              value={currentField.label}
              onChange={(e) => setCurrentField(prev => ({ ...prev, label: e.target.value }))}
              margin="normal"
              required
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Field Type</InputLabel>
              <Select
                value={currentField.type}
                label="Field Type"
                onChange={(e) => setCurrentField(prev => ({ ...prev, type: e.target.value, options: [] }))}
              >
                {FIELD_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {type.icon}
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Placeholder Text"
              value={currentField.placeholder}
              onChange={(e) => setCurrentField(prev => ({ ...prev, placeholder: e.target.value }))}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Help Text"
              value={currentField.help_text}
              onChange={(e) => setCurrentField(prev => ({ ...prev, help_text: e.target.value }))}
              margin="normal"
              placeholder="Optional help text to guide users"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={currentField.required}
                  onChange={(e) => setCurrentField(prev => ({ ...prev, required: e.target.checked }))}
                />
              }
              label="Required field"
              sx={{ mt: 2 }}
            />

            {/* Options for select, radio, checkbox fields */}
            {['select', 'radio', 'checkbox'].includes(currentField.type) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Options
                </Typography>
                
                {currentField.options.map((option, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    <IconButton onClick={() => removeOption(index)} size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                
                <Button
                  startIcon={<AddIcon />}
                  onClick={addOption}
                  size="small"
                >
                  Add Option
                </Button>
              </Box>
            )}
          </DialogContent>
          
          <DialogActions>
            <Button onClick={closeFieldDialog}>Cancel</Button>
            <Button onClick={saveField} variant="contained">
              {editingField ? 'Update' : 'Add'} Field
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default OnboardingFormBuilder;