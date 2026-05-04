import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#5b5a5f', // Temple Brown-Gray
      light: '#74737a',
      dark: '#45444a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#c28b2c', // Temple Gold
      light: '#d6ab5d',
      dark: '#9b6e1f',
      contrastText: '#1f1a12',
    },
    error: {
      main: '#8f2d2d', // Deep Maroon Red
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#1d2328',
      secondary: '#5f6770',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(7,45,49,0.06)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontWeight: 500,
          color: '#1d2328',
          fontSize: '1.3rem',
          lineHeight: 1.2,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;
