import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import {
  RestaurantMenu as ChefIcon,
  Psychology as BrainIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const MenuGenerationProgress = ({ open, onClose, progress, allowClose = false }) => {
  const getPhaseIcon = (phase) => {
    switch (phase) {
      case 'initializing':
        return <ChefIcon color="primary" />;
      case 'uploading':
        return <UploadIcon color="info" />;
      case 'generating':
        return <BrainIcon color="secondary" />;
      case 'complete':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CircularProgress size={24} />;
    }
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'initializing':
        return 'primary';
      case 'uploading':
        return 'info';
      case 'generating':
        return 'secondary';
      case 'complete':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEstimatedTimeMessage = (phase, progress) => {
    if (phase === 'generating') {
      if (progress < 30) {
        return "This usually takes 2-3 minutes for detailed meal plans...";
      } else if (progress < 60) {
        return "AI is carefully crafting each recipe with your preferences...";
      } else if (progress < 90) {
        return "Almost done! Adding final touches to your meal plan...";
      }
    }
    return null;
  };

  if (!progress) return null;

  return (
    <Dialog 
      open={open} 
      onClose={allowClose ? onClose : undefined}
      disableEscapeKeyDown={!allowClose}
      PaperProps={{
        sx: {
          minWidth: 400,
          minHeight: 200
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          {getPhaseIcon(progress.phase)}
          <Typography variant="h6">
            Generating Your Meal Plan
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body1" color="textSecondary">
              {progress.message}
            </Typography>
            <Chip 
              label={progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)}
              color={getPhaseColor(progress.phase)}
              size="small"
              variant="outlined"
            />
          </Box>
          
          <LinearProgress 
            variant="determinate" 
            value={progress.progress || 0}
            sx={{ 
              height: 8, 
              borderRadius: 4,
              backgroundColor: 'rgba(0,0,0,0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4
              }
            }}
          />
          
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color="textSecondary">
              {Math.round(progress.progress || 0)}% Complete
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {progress.phase === 'generating' ? 'Please wait...' : ''}
            </Typography>
          </Box>
        </Box>

        {/* Estimated time message */}
        {getEstimatedTimeMessage(progress.phase, progress.progress) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {getEstimatedTimeMessage(progress.phase, progress.progress)}
          </Alert>
        )}

        {/* Error handling */}
        {progress.phase === 'error' && progress.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Error:</strong> {progress.error}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Don't worry! We're checking if your meal plan was created successfully...
            </Typography>
          </Alert>
        )}

        {/* Success message */}
        {progress.phase === 'complete' && (
          <Alert severity="success">
            <Typography variant="body2">
              🎉 Your personalized meal plan is ready! It includes all your requested meals with proper nutrition balancing.
            </Typography>
          </Alert>
        )}

        {/* Generation tips */}
        {progress.phase === 'generating' && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              💡 <strong>What's happening:</strong>
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block">
              • AI is analyzing your dietary preferences and restrictions
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block">
              • Creating balanced recipes that meet your nutrition goals  
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block">
              • Ensuring variety and avoiding repeated ingredients
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block">
              • Validating cooking times match your schedule
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {allowClose && (
          <>
            <Button onClick={onClose} color="primary">
              Close
            </Button>
            {progress?.phase === 'error' && (
              <Button
                onClick={() => {
                  onClose();
                  // Trigger a page refresh to reset state
                  window.location.reload();
                }}
                color="primary"
                variant="contained"
              >
                Try Again
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MenuGenerationProgress;