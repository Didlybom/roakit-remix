import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GitHubIcon from '@mui/icons-material/GitHub';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTheme } from '@mui/material/styles';
import JiraIcon from '../icons/Jira';
import { View } from './App';
import DrawerHeader from './DrawerHeader';

export default function NavDrawer({
  view,
  width,
  open,
  onClose,
}: {
  view: View;
  width: number;
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Drawer
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width, boxSizing: 'border-box' },
      }}
      variant="persistent"
      anchor="left"
      open={open}
    >
      <DrawerHeader>
        <IconButton onClick={onClose}>
          {theme.direction === 'ltr' ?
            <ChevronLeftIcon />
          : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        <ListItem key="dashboard" disablePadding>
          <ListItemButton href="/dashboard" selected={view === 'dashboard'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <DashboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'Dashboard'} />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem key="github" disablePadding>
          <ListItemButton href="/github" selected={view === 'github'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'GitHub Feed'} />
          </ListItemButton>
        </ListItem>
        <ListItem key="jira" disablePadding>
          <ListItemButton href="/jira" selected={view === 'jira'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <JiraIcon />
            </ListItemIcon>
            <ListItemText primary={'Jira Feed'} />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
