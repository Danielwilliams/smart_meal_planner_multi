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
    // optional custom fonts, etc.
  }
});

export default theme;
