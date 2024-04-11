import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import GitHubIcon from '@mui/icons-material/GitHub';
import GroupIcon from '@mui/icons-material/Group';
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
} from '@mui/material';
import JiraIcon from '../icons/Jira';
import { View } from './App';
import DrawerHeader from './NavDrawerHeader';
import Pulse from './Pulse';

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
        <ListItem key="dashboard" disablePadding>
          <ListItemButton href="/dashboard" selected={view === 'dashboard'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <DashboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'Dashboard'} />
          </ListItemButton>
        </ListItem>
        <ListItem key="activity" disablePadding>
          <ListItemButton href="/activity" selected={view === 'activity'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <FormatListBulletedIcon />
            </ListItemIcon>
            <ListItemText primary={'All Activity'} />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem key="initiatives" disablePadding>
          <ListItemButton href="/initiatives" selected={view === 'initiatives'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <BusinessCenterIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'Initiatives'} />
          </ListItemButton>
        </ListItem>
        <ListItem key="contributors" disablePadding>
          <ListItemButton href="/users" selected={view === 'users'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <GroupIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'Contributors'} />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListSubheader color="primary">Real-time atomic data</ListSubheader>
        <ListItem key="github" disablePadding>
          <ListItemButton href="/source/github" selected={view === 'github'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={'GitHub feed'} />
          </ListItemButton>
        </ListItem>
        <ListItem key="jira" disablePadding>
          <ListItemButton href="/source/jira" selected={view === 'jira'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <JiraIcon />
            </ListItemIcon>
            <ListItemText primary={'Jira feed'} />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
