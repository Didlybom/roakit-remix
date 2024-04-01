import { styled } from '@mui/material';

// see https://mui.com/material-ui/react-drawer/#persistent-drawer
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  minHeight: '48px', // dense toolbar
}));

export default DrawerHeader;
