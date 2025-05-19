import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree
 * and display a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      const fallback = this.props.fallback || (
        <Box 
          sx={{
            p: 2,
            border: '1px solid #f5c6cb',
            borderRadius: 1,
            bgcolor: '#f8d7da',
            color: '#721c24',
            my: 2
          }}
        >
          <Box display="flex" alignItems="center" mb={1}>
            <ErrorOutline color="error" sx={{ mr: 1 }} />
            <Typography variant="h6">Something went wrong</Typography>
          </Box>
          
          <Typography variant="body2" gutterBottom>
            {this.state.error?.toString() || "An unexpected error occurred"}
          </Typography>
          
          {this.props.showReportInfo && (
            <Typography variant="caption" display="block" mt={1}>
              Please try again or report this issue if it persists.
            </Typography>
          )}
        </Box>
      );
      
      return fallback;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;