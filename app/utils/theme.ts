import { green, indigo, red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';

export const prioritySymbols: Record<number, string> = {
  1: '!!',
  2: '!',
  3: '–',
  4: '↓',
  5: '↓↓',
};

export const priorityLabels: Record<number, string> = {
  1: 'Highest',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Lowest',
};

export const priorityColors: Record<number, string> = {
  1: '#f26d50',
  2: '#f17c37',
  3: '#f2c43d',
  4: '#a7ecf2',
  5: '#3e9cbf',
};

const theme = createTheme({
  palette: {
    primary: { main: indigo[400] },
    secondary: { main: green[700] },
    error: { main: red.A400 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 8 },
      },
    },
  },
});

export const getThemeContrastText = (color?: string | null) =>
  color ? theme.palette.getContrastText(color) : undefined;

export default theme;
