import { alpha, createTheme, type PaletteMode, type ThemeOptions } from '@mui/material/styles';

const brand = {
  ink: '#0c0e0d',
  forest: '#142118',
  green: '#2f9e44',
  lime: '#78d13f',
};

function buildTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const palette = {
    mode,
    primary: dark
      ? { main: '#72d44c', light: '#9bea76', dark: '#45a92d', contrastText: '#071008' }
      : { main: '#1f7a35', light: '#3fa653', dark: '#145525', contrastText: '#ffffff' },
    secondary: dark
      ? { main: '#a4eb63', light: '#c4f391', dark: '#6fbe37', contrastText: '#071008' }
      : { main: '#63b832', light: '#8bd45d', dark: '#3d8a1d', contrastText: '#071008' },
    success: dark
      ? { main: '#64cf63', light: '#94e492', dark: '#389d3c', contrastText: '#071008' }
      : { main: '#238636', light: '#48a95b', dark: '#175c28', contrastText: '#ffffff' },
    warning: { main: dark ? '#f0b84b' : '#b66a08', contrastText: '#071008' },
    error: { main: dark ? '#ff6b6b' : '#c9363e' },
    info: { main: dark ? '#65b8e8' : '#2479a8' },
    background: dark
      ? { default: '#080d0a', paper: '#111814' }
      : { default: '#f3f6f2', paper: '#ffffff' },
    text: dark
      ? { primary: '#f3f7f4', secondary: 'rgba(231,240,233,0.72)', disabled: 'rgba(231,240,233,0.42)' }
      : { primary: '#142118', secondary: '#526059', disabled: '#89938d' },
    divider: dark ? 'rgba(184,220,191,0.13)' : 'rgba(20,54,30,0.12)',
    action: {
      hover: dark ? 'rgba(114,212,76,0.08)' : 'rgba(31,122,53,0.07)',
      selected: dark ? 'rgba(114,212,76,0.13)' : 'rgba(31,122,53,0.11)',
      focus: dark ? 'rgba(114,212,76,0.18)' : 'rgba(31,122,53,0.16)',
      disabledBackground: dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,33,24,0.08)',
    },
  } as const;

  const options: ThemeOptions = {
    palette,
    shape: { borderRadius: 12 },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1280, xl: 1920 } },
    typography: {
      fontFamily: '"Inter Variable", Inter, "Roboto Flex", "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 760, fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.035em' },
      h2: { fontWeight: 740, fontSize: 'clamp(1.7rem, 3vw, 2.35rem)', lineHeight: 1.12, letterSpacing: '-0.03em' },
      h3: { fontWeight: 720, fontSize: 'clamp(1.45rem, 2.4vw, 1.9rem)', lineHeight: 1.18, letterSpacing: '-0.025em' },
      h4: { fontWeight: 720, fontSize: 'clamp(1.35rem, 2vw, 1.7rem)', lineHeight: 1.2, letterSpacing: '-0.025em' },
      h5: { fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.25, letterSpacing: '-0.015em' },
      h6: { fontWeight: 680, fontSize: '1rem', lineHeight: 1.3 },
      button: { fontWeight: 680, letterSpacing: '-0.005em' },
      overline: { fontWeight: 750, letterSpacing: '0.12em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: {
            backgroundColor: palette.background.default,
            backgroundImage: dark
              ? 'radial-gradient(circle at 88% -10%, rgba(80,160,65,0.10), transparent 34%), radial-gradient(circle at 15% 110%, rgba(31,92,45,0.08), transparent 30%)'
              : 'radial-gradient(circle at 90% 0%, rgba(90,170,82,0.08), transparent 30%)',
            backgroundAttachment: 'fixed',
            '--kb-calendar-border': palette.divider,
            '--kb-calendar-muted': dark ? '#0d1410' : '#eef3ee',
            '--kb-calendar-off-range': dark ? '#0a100c' : '#f7f9f7',
          },
          '::selection': { backgroundColor: alpha(palette.primary.main, 0.32) },
          '*': { scrollbarColor: `${alpha(palette.text.secondary, 0.35)} transparent` },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            color: palette.text.primary,
            background: dark ? 'rgba(8,13,10,0.90)' : 'rgba(255,255,255,0.88)',
            borderBottom: `1px solid ${palette.divider}`,
            boxShadow: 'none',
            backdropFilter: 'blur(18px) saturate(140%)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderColor: palette.divider,
          },
          rounded: { borderRadius: 14 },
          elevation1: {
            border: `1px solid ${palette.divider}`,
            boxShadow: dark ? '0 14px 40px rgba(0,0,0,0.20)' : '0 12px 34px rgba(25,55,32,0.07)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${palette.divider}`,
            borderRadius: 16,
            backgroundColor: palette.background.paper,
            boxShadow: dark ? '0 16px 44px rgba(0,0,0,0.20)' : '0 14px 36px rgba(24,58,32,0.07)',
            transition: 'border-color .18s ease, box-shadow .18s ease, transform .18s ease',
            '&:hover': {
              borderColor: alpha(palette.primary.main, dark ? 0.34 : 0.24),
              boxShadow: dark ? '0 18px 50px rgba(0,0,0,0.27)' : '0 18px 44px rgba(24,58,32,0.10)',
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 42, borderRadius: 10, paddingInline: 16, textTransform: 'none' },
          contained: {
            '&.MuiButton-containedPrimary': {
              background: dark
                ? 'linear-gradient(135deg, #72d44c, #54b936)'
                : 'linear-gradient(135deg, #1f7a35, #2f9445)',
              boxShadow: dark
                ? '0 8px 22px rgba(73,171,48,0.18)'
                : '0 8px 20px rgba(31,122,53,0.17)',

              '&:hover': {
                boxShadow: dark
                  ? '0 10px 28px rgba(73,171,48,0.26)'
                  : '0 10px 26px rgba(31,122,53,0.23)',
              },
            },
          },
          outlined: { borderColor: alpha(palette.text.primary, 0.2), '&:hover': { borderColor: palette.primary.main } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 10, color: palette.text.secondary, '&:hover': { color: palette.primary.main, backgroundColor: palette.action.hover } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 620 },
          // Only neutral chips use the subtle brand tint. Applying this background
          // to every filled chip breaks semantic colors: e.g. color="primary"
          // keeps primary.contrastText while its solid background gets replaced.
          filled: {
            '&.MuiChip-colorDefault': {
              backgroundColor: alpha(palette.primary.main, 0.11),
              color: palette.text.primary,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: dark ? 'rgba(255,255,255,0.025)' : 'rgba(20,50,28,0.018)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(palette.text.primary, 0.18) },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(palette.primary.main, 0.55) },
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { border: `1px solid ${palette.divider}`, borderRadius: 18 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: palette.divider },
          head: { color: palette.text.secondary, fontWeight: 700, backgroundColor: dark ? '#0e1511' : '#f7faf7' },
        },
      },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: dark ? '#243028' : '#142118', borderRadius: 8 } } },
      MuiBottomNavigation: { styleOverrides: { root: { backgroundColor: dark ? '#0d1410' : '#ffffff' } } },
      MuiBottomNavigationAction: {
        styleOverrides: { root: { color: palette.text.secondary, '&.Mui-selected': { color: palette.primary.main } } },
      },
      MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 99 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 44, textTransform: 'none', fontWeight: 650 } } },
      MuiToolbar: { styleOverrides: { root: { minHeight: '64px !important', '@media (max-width:600px)': { minHeight: '56px !important' } } } },
    },
  };

  return createTheme(options);
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
export { brand };
