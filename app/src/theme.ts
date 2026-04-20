import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0EA5E9',
      light: '#89CEFF',
      dark: '#006591',
    },
    secondary: {
      main: '#3C627D',
      light: '#A5CBE9',
      dark: '#234B64',
    },
    background: {
      default: '#F9F9FF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111C2D',
      secondary: '#3E4850',
    },
    divider: '#D8E3FB',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 800, letterSpacing: 0 },
    h2: { fontWeight: 700, letterSpacing: 0 },
    h3: { fontWeight: 700, letterSpacing: 0 },
    h4: { fontWeight: 700, letterSpacing: 0 },
    h5: { fontWeight: 600, letterSpacing: 0 },
    h6: { fontWeight: 600, letterSpacing: 0 },
    subtitle1: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: 'none',
          backgroundImage: 'linear-gradient(180deg, #0EA5E9 0%, #006591 100%)',
          color: '#FFFFFF',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 6px 12px -2px rgba(14, 165, 233, 0.2)',
          },
          '&:active': {
            transform: 'translateY(0)',
          }
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          }
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          border: '1px solid rgba(255,255,255,0.5)',
          background: '#FFFFFF',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#FFFFFF',
          borderBottom: '1px solid rgba(23, 32, 42, 0.08)',
          boxShadow: 'none',
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#F0F3FF',
            transition: 'all 0.2s',
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: '#BEC8D2',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'transparent',
              borderBottomColor: '#0EA5E9',
              borderBottomWidth: '2px',
            },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 12px -2px rgba(14, 165, 233, 0.08)',
            }
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '1rem',
        }
      }
    }
  },
});

export default theme;
