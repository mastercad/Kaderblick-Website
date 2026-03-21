import { createTheme, ThemeOptions } from '@mui/material/styles';

// Gemeinsame Theme-Basis
const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: '"Roboto flex", Inter, Montserrat, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 600,
      fontSize: '2.5rem',
      '@media (max-width:600px)': {
        fontSize: '2rem',
      },
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
      },
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
    },
    h6: {
      fontSize: '1rem',
      '@media (max-width:600px)': {
        fontSize: '0.95rem',
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 44, // Better touch targets
          '@media (max-width:600px)': {
            minHeight: 48,
          },
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            transform: 'translateY(0px)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            padding: 8,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '64px !important',
          '@media (max-width:600px)': {
            minHeight: '56px !important',
            paddingLeft: 8,
            paddingRight: 8,
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            paddingLeft: 8,
            paddingRight: 8,
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: '#018606',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: '#02b008',
          },
        },
        colorDefault: {
          backgroundColor: '#018606',
          color: 'primary.contrastText',
        },
      },
    },
  },
};

// Light Theme mit Grün-Gradient
export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#018606', // Primäres Grün
      light: '#02b008', // Hellere, frischere Variante für Hover
      dark: '#015504', // Dunklere Variante
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00c853',
      light: '#5efc82',
      dark: '#009624',
      // #fff auf #00c853 = 2.24:1 → schl​ägt WCAG; schwarz = 9.38:1
      contrastText: '#000000',
    },
    success: {
      main: '#00e676', // Leuchtend grün für Erfolg
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a1a', // Satteres Schwarz
      secondary: '#424242', // Dunkleres Grau für besseren Kontrast
    },
  },
  components: {
    ...baseTheme.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #018606 0%, #00c853 100%)',
        },
      },
    },
    MuiButton: {
      ...baseTheme.components?.MuiButton,
      styleOverrides: {
        ...baseTheme.components?.MuiButton?.styleOverrides,
        containedPrimary: {
          backgroundColor: '#018606',
          '&:hover': {
            backgroundColor: '#02b008', // Heller beim Hover
          },
        },
        containedSecondary: {
          backgroundColor: '#00c853',
          '&:hover': {
            backgroundColor: '#5efc82', // Heller beim Hover
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            backgroundColor: 'rgba(1, 134, 6, 0.08)', // Leichter grüner Hintergrund
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(1, 134, 6, 0.08)', // Leichter grüner Hintergrund
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
        },
        primary: {
          backgroundColor: '#018606',
          '&:hover': {
            backgroundColor: '#02b008', // Heller beim Hover
            transform: 'scale(1.05)',
          },
        },
        secondary: {
          backgroundColor: '#00c853',
          '&:hover': {
            backgroundColor: '#5efc82', // Heller beim Hover
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
});

// Dark Theme mit Grün-Accent
export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#4caf50', // Helleres Grün – besser sichtbar auf dunklem Untergrund
      light: '#80e27e',
      dark: '#087f23',
      // Schwarz als contrastText: #000 auf #4caf50 = 7.55:1 (WCAG AAA)
      // Weiß würde nur 2.78:1 ergeben → schlägt WCAG AA
      contrastText: '#000000',
    },
    secondary: {
      main: '#00e676', // Leuchtendes Grün als Akzent
      light: '#66ffa6',
      dark: '#00b248',
      contrastText: '#000000', // #000 auf #00e676 = 12.6:1 (WCAG AAA)
    },
    success: {
      main: '#00e676',
    },
    background: {
      default: '#121212', // Standard Material Design Dark
      paper: '#1e1e1e',   // Karten/Sheet-Oberflächen
    },
    text: {
      primary: 'rgba(255,255,255,0.87)',
      secondary: 'rgba(255,255,255,0.60)', // Lesbar auf dunklem Grund
      disabled: 'rgba(255,255,255,0.38)',
    },
  },
  components: {
    ...baseTheme.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #2e7d32 0%, #43a047 100%)',
          // AppBar-Text explizit weiß – unabhängig von primary.contrastText,
          // das für Buttons auf #000 gesetzt ist.
          color: 'rgba(255,255,255,0.87)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // MUI fügt sonst elevation-overlay ein
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2a2a2a',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2a2a2a',
        },
        list: {
          color: 'rgba(255,255,255,0.87)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.87)',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(76,175,80,0.16)',
            '&:hover': {
              backgroundColor: 'rgba(76,175,80,0.24)',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: 'rgba(255,255,255,0.60)',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.87)',
        },
        input: {
          '&::placeholder': {
            color: 'rgba(255,255,255,0.38)',
            opacity: 1,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: 'rgba(255,255,255,0.23)',
        },
        root: {
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.40)',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.60)',
          '&.Mui-focused': {
            color: '#80e27e',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.60)',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        secondary: {
          color: 'rgba(255,255,255,0.60)',
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          color: 'rgba(255,255,255,0.60)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#3a3a3a',
          color: 'rgba(255,255,255,0.87)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.87)',
          },
        },
        deleteIcon: {
          color: 'rgba(255,255,255,0.60)',
          '&:hover': {
            color: 'rgba(255,255,255,0.87)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.12)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.60)',
          '&.Mui-selected': {
            color: '#80e27e',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#4caf50',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          color: 'rgba(255,255,255,0.60)',
          '&.Mui-checked': {
            color: '#4caf50',
          },
          '&.Mui-checked + .MuiSwitch-track': {
            backgroundColor: '#4caf50',
          },
        },
        track: {
          backgroundColor: 'rgba(255,255,255,0.30)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.70)',
          '@media (max-width:600px)': {
            padding: 8,
          },
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.08)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.87)',
        },
        head: {
          color: 'rgba(255,255,255,0.60)',
          fontWeight: 600,
        },
      },
    },
  },
});
