import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Autocomplete,
  Switch,
  FormControlLabel,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Notes as NotesIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Priority as PriorityIcon,
  Label as TagIcon,
  Template as TemplateIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Archive as ArchiveIcon,
  Visibility as ViewIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import apiService from '../services/apiService';

const NOTE_TYPES = [
  { value: 'general', label: 'General', color: 'default' },
  { value: 'consultation', label: 'Consultation', color: 'primary' },
  { value: 'preference', label: 'Preference', color: 'secondary' },
  { value: 'goal', label: 'Goal', color: 'success' },
  { value: 'observation', label: 'Observation', color: 'warning' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'default' },
  { value: 'normal', label: 'Normal', color: 'primary' },
  { value: 'high', label: 'High', color: 'warning' },
  { value: 'urgent', label: 'Urgent', color: 'error' }
];

const ClientNotesManager = ({ organizationId, clientId, clientName, onClose }) => {
  const [notes, setNotes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState({
    note_type: '',
    priority: '',
    tags: '',
    include_archived: false
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    note_type: 'general',
    priority: 'normal',
    is_private: true,
    tags: []
  });

  useEffect(() => {
    loadNotes();
    loadTemplates();
  }, [organizationId, clientId, filters]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const notesData = await apiService.getClientNotes(organizationId, clientId, filters);
      setNotes(notesData);
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load client notes');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesData = await apiService.getNoteTemplates(organizationId);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const handleOpenDialog = (note = null) => {
    if (note) {
      setEditingNote(note);
      setNoteForm({
        title: note.title || '',
        content: note.content,
        note_type: note.note_type,
        priority: note.priority,
        is_private: note.is_private,
        tags: note.tags || []
      });
    } else {
      setEditingNote(null);
      setNoteForm({
        title: '',
        content: '',
        note_type: 'general',
        priority: 'normal',
        is_private: true,
        tags: []
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingNote(null);
    setNoteForm({
      title: '',
      content: '',
      note_type: 'general',
      priority: 'normal',
      is_private: true,
      tags: []
    });
  };

  const handleSaveNote = async () => {
    try {
      const noteData = {
        ...noteForm,
        client_id: clientId
      };

      if (editingNote) {
        await apiService.updateClientNote(organizationId, editingNote.id, noteData);
      } else {
        await apiService.createClientNote(organizationId, noteData);
      }

      handleCloseDialog();
      loadNotes();
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await apiService.deleteClientNote(organizationId, noteId);
        loadNotes();
      } catch (err) {
        console.error('Error deleting note:', err);
        setError('Failed to delete note');
      }
    }
  };

  const handleUseTemplate = (template) => {
    setNoteForm({
      ...noteForm,
      content: template.template_content,
      note_type: template.note_type,
      tags: template.suggested_tags || []
    });
  };

  const handleArchiveNote = async (noteId, archived) => {
    try {
      await apiService.updateClientNote(organizationId, noteId, { is_archived: archived });
      loadNotes();
    } catch (err) {
      console.error('Error archiving note:', err);
      setError('Failed to archive note');
    }
  };

  const filteredNotes = notes.filter(note => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (note.title && note.title.toLowerCase().includes(searchLower)) ||
        note.content.toLowerCase().includes(searchLower) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }
    return true;
  });

  const getNoteTypeColor = (type) => {
    const noteType = NOTE_TYPES.find(t => t.value === type);
    return noteType ? noteType.color : 'default';
  };

  const getPriorityColor = (priority) => {
    const priorityObj = PRIORITIES.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : 'default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotesIcon color="primary" />
          <Typography variant="h5">
            Notes for {clientName}
          </Typography>
          <Badge badgeContent={notes.length} color="primary">
            <Chip label="Total Notes" variant="outlined" />
          </Badge>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Note
          </Button>
          {onClose && (
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.note_type}
                onChange={(e) => setFilters({...filters, note_type: e.target.value})}
              >
                <MenuItem value="">All Types</MenuItem>
                {NOTE_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
              >
                <MenuItem value="">All Priorities</MenuItem>
                {PRIORITIES.map(priority => (
                  <MenuItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Filter by tags..."
              value={filters.tags}
              onChange={(e) => setFilters({...filters, tags: e.target.value})}
              helperText="Comma-separated tags"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.include_archived}
                  onChange={(e) => setFilters({...filters, include_archived: e.target.checked})}
                />
              }
              label="Show Archived"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Notes List */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : filteredNotes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <NotesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No notes found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm || Object.values(filters).some(f => f) 
              ? 'Try adjusting your search or filters'
              : 'Start by adding your first note about this client'
            }
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add First Note
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredNotes.map((note) => (
            <Grid item xs={12} md={6} lg={4} key={note.id}>
              <Card sx={{ 
                height: '100%',
                opacity: note.is_archived ? 0.7 : 1,
                border: note.priority === 'urgent' ? '2px solid' : '1px solid',
                borderColor: note.priority === 'urgent' ? 'error.main' : 'grey.300'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ 
                      wordBreak: 'break-word',
                      flex: 1,
                      fontSize: '1rem'
                    }}>
                      {note.title || 'Untitled Note'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Chip
                        label={note.note_type}
                        size="small"
                        color={getNoteTypeColor(note.note_type)}
                        variant="outlined"
                      />
                      <Chip
                        label={note.priority}
                        size="small"
                        color={getPriorityColor(note.priority)}
                      />
                    </Box>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {note.content}
                  </Typography>
                  
                  {note.tags && note.tags.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      {note.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                  
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(note.created_at)}
                    {note.updated_at !== note.created_at && ' (edited)'}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <Tooltip title="Edit Note">
                    <IconButton size="small" onClick={() => handleOpenDialog(note)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={note.is_archived ? "Unarchive" : "Archive"}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleArchiveNote(note.id, !note.is_archived)}
                    >
                      <ArchiveIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Note">
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Note Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingNote ? 'Edit Note' : 'Add New Note'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Note Title (optional)"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({...noteForm, title: e.target.value})}
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Note Type</InputLabel>
                  <Select
                    value={noteForm.note_type}
                    onChange={(e) => setNoteForm({...noteForm, note_type: e.target.value})}
                  >
                    {NOTE_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={noteForm.priority}
                    onChange={(e) => setNoteForm({...noteForm, priority: e.target.value})}
                  >
                    {PRIORITIES.map(priority => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={noteForm.tags}
                  onChange={(event, newValue) => {
                    setNoteForm({...noteForm, tags: newValue});
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Add tags..."
                      helperText="Press Enter to add tags"
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={noteForm.is_private}
                      onChange={(e) => setNoteForm({...noteForm, is_private: e.target.checked})}
                    />
                  }
                  label="Private note (only visible to organization)"
                />
              </Grid>
              
              {templates.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Use Template:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {templates.map(template => (
                      <Button
                        key={template.id}
                        size="small"
                        variant="outlined"
                        startIcon={<TemplateIcon />}
                        onClick={() => handleUseTemplate(template)}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </Box>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Note Content"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({...noteForm, content: e.target.value})}
                  required
                  margin="normal"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveNote} 
            variant="contained"
            disabled={!noteForm.content.trim()}
          >
            {editingNote ? 'Update' : 'Save'} Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientNotesManager;