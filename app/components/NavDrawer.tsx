import BusinessIcon from '@mui/icons-material/Business';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GitHubIcon from '@mui/icons-material/GitHub';
import PeopleIcon from '@mui/icons-material/People';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  SvgIconTypeMap,
} from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import JiraIcon from '../icons/Jira';
import { View } from './App';
import DrawerHeader from './NavDrawerHeader';
import Pulse from './Pulse';

const listItem = (
  view: View,
  url: string,
  Icon: OverridableComponent<SvgIconTypeMap>,
  label: string,
  currentView: View
) => (
  <ListItem key={view} disablePadding>
    <ListItemButton href={url} selected={currentView === view}>
      <ListItemIcon sx={{ minWidth: '30px' }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  </ListItem>
);

export default function NavDrawer({
  view,
  width,
  showPulse,
  open,
  onClose,
}: {
  view: View;
  width: number;
  showPulse?: boolean;
  open: boolean;
  onClose: () => void;
}) {
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
        {showPulse && (
          <Box title="This page show real-time activity" sx={{ mb: '8px', ml: '20px' }}>
            <Pulse />
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose}>
          <ChevronLeftIcon />
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        {listItem('dashboard', '/dashboard', DashboardIcon, 'Dashboard', view)}
        {listItem('activity.user', '/activity/user/*', PeopleIcon, 'By Contributor', view)}
        {listItem('activity', '/activity', PeopleIcon, 'All Activity', view)}
      </List>
      <Divider />
      <List>
        {listItem('initiatives', '/initiatives', BusinessCenterIcon, 'Initiatives', view)}
        {listItem('users', '/users', BusinessIcon, 'Directory', view)}
      </List>
      <Divider />
      <List>
        <ListSubheader color="primary">Real-time atomic data</ListSubheader>
        {listItem('github', '/source/github', GitHubIcon, 'GitHub feed', view)}
        {listItem('jira', '/source/jira', JiraIcon, 'Jira feed', view)}
      </List>
    </Drawer>
  );
}
