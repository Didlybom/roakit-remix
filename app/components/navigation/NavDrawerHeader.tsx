import { styled } from '@mui/material';

// see https://mui.com/material-ui/react-drawer/#persistent-drawer
const DrawerHeader = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  // necessary for content to be below app bar
  minHeight: '48px', // dense toolbar
}));

export default DrawerHeader;
