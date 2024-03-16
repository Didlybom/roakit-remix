import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
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
        <ListItem key="review" disablePadding>
          <ListItemButton href="/activity/review" selected={view === 'activity.review'}>
            <ListItemIcon sx={{ minWidth: '30px' }}>
              <EditNoteIcon />
            </ListItemIcon>
            <ListItemText primary={'Review'} />
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
