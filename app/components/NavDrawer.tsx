import {
  BusinessCenter as BusinessCenterIcon,
  Business as BusinessIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  GitHub as GitHubIcon,
  History as HistoryIcon,
  Subject as SubjectIcon,
  Summarize as SummarizeIcon,
} from '@mui/icons-material';
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
import { grey } from '@mui/material/colors';
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
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 'smaller' }} />
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
        {listItem('activity.user', '/activity/user/*', SubjectIcon, 'Recent Activity', view)}
        {listItem('activity', '/activity', HistoryIcon, 'All Activity', view)}
        {listItem('summary.user', '/summaries', SummarizeIcon, 'Summaries', view)}
      </List>
      <Divider />
      <List>
        <ListSubheader sx={{ fontSize: 'small', lineHeight: '36px', color: grey[400] }}>
          Administration
        </ListSubheader>
        {listItem('initiatives', '/initiatives', BusinessCenterIcon, 'Initiatives', view)}
        {listItem('users', '/users', BusinessIcon, 'Directory', view)}
      </List>
      <Divider />
      <List sx={{ opacity: 0.4 }}>
        <ListSubheader sx={{ fontSize: 'small', lineHeight: '36px' }}>
          Real-time ingestion
        </ListSubheader>
        {listItem('github', '/source/github', GitHubIcon, 'GitHub feed', view)}
        {listItem('jira', '/source/jira', JiraIcon, 'Jira feed', view)}
      </List>
    </Drawer>
  );
}
