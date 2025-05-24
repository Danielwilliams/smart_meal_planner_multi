// meal_planner_frontend/web/src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4caf50'  // green
    },
    secondary: {
      main: '#ff9800' // orange
    }
  },
  typography: {
    // Responsive font sizes
    h4: {
      fontSize: '1.75rem',
      '@media (min-width:600px)': {
        fontSize: '2rem',
      },
    },
    h6: {
      fontSize: '1.1rem',
      '@media (min-width:600px)': {
        fontSize: '1.25rem',
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          // Larger touch target for mobile
          '@media (max-width:600px)': {
            minHeight: '44px',
            padding: '8px 16px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // Larger touch target for mobile
          '@media (max-width:600px)': {
            padding: '12px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            marginBottom: '16px',
          },
        },
      },
    },
  },
});

export default theme;
