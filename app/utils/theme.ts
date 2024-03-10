import { green, indigo, red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: indigo[400] },
    secondary: { main: green[700] },
    error: { main: red.A400 },
  },
});

export const disabledNotOpaqueSx = {
  ['&.Mui-disabled']: { opacity: 'initial' },
};

export default theme;
