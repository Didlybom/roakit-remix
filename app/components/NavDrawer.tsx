import {
  BusinessCenter as BusinessCenterIcon,
  Business as BusinessIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Science as ScienceIcon,
  Subject as SubjectIcon,
  ShortText as SummariesIcon,
  EditNote as SummaryIcon,
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
  Typography,
} from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { grey } from '@mui/material/colors';
import { Role, View } from '../utils/rbac';
import DrawerHeader from './NavDrawerHeader';
import Pulse from './Pulse';

const listItem = (
  view: View | null,
  url: string,
  Icon: OverridableComponent<SvgIconTypeMap>,
  label: string,
  currentView: View
) => (
  <ListItem key={view} disablePadding>
    <ListItemButton href={url} target={view ? '_self' : '_blank'} selected={currentView === view}>
      <ListItemIcon sx={{ minWidth: '30px' }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 'smaller' }} />
    </ListItemButton>
  </ListItem>
);

export default function NavDrawer({
  role,
  view,
  width,
  showPulse,
  open,
  onClose,
}: {
  role: Role;
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
      open={open}
    >
      <DrawerHeader>
        {showPulse && (
          <Box title="This page show real-time activity" mb="8px" ml="20px">
            <Pulse />
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose}>
          <ChevronLeftIcon />
        </IconButton>
      </DrawerHeader>
      <Divider />
      {(role === Role.Admin || role === Role.Monitor) && (
        <>
          <List>
            {listItem(View.Dashboard, '/dashboard', DashboardIcon, 'Dashboard', view)}
            {listItem(
              View.ActivityUser,
              '/activity/user/*',
              SubjectIcon,
              'Contributor Activity',
              view
            )}
            {listItem(View.Activity, '/activity', HistoryIcon, 'All Activity', view)}
          </List>
          <Divider />
        </>
      )}
      <List>{listItem(View.Summary, '/summary', SummaryIcon, 'Summary Form', view)}</List>
      {role === Role.Admin && (
        <>
          <Divider />
          <List>
            <ListSubheader sx={{ fontSize: 'small', lineHeight: '36px', color: grey[400] }}>
              Administration
            </ListSubheader>
            {listItem(View.Initiatives, '/goals', BusinessCenterIcon, 'Goals', view)}
            {listItem(View.Users, '/users', BusinessIcon, 'Directory', view)}
          </List>
        </>
      )}
      {(role === Role.Admin || role === Role.Monitor) && (
        <>
          <Divider />
          <List>
            <ListSubheader sx={{ fontSize: 'small', lineHeight: '36px', color: grey[400] }}>
              Lab
            </ListSubheader>
            {listItem(View.SummaryMulti, '/summary/multi', SummariesIcon, 'Summaries', view)}
            {listItem(null, '/ai', ScienceIcon, 'AI Playground', view)}
          </List>
        </>
      )}
      <Box flexGrow={1} />
      <Box p={1} sx={{ backgroundColor: grey[50] }} borderTop="solid 1px" borderColor={grey[200]}>
        <Typography variant="body2" color="text.secondary" pl={1}>
          {'© ROAKIT'} {new Date().getFullYear()}.
        </Typography>
        <Typography variant="body2" color="text.disabled" pl={1}>
          Work in progress.
        </Typography>
      </Box>
    </Drawer>
  );
}
