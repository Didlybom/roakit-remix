import { Avatar, Box, Chip } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import theme from '../utils/theme';

export default function smallAvatarChip({ name }: { name: string | undefined }) {
  const bgcolor = stringColor(name);
  return (
    <Chip
      size="small"
      label={name ?? 'Unknown'}
      title={name}
      avatar={
        <Avatar sx={{ bgcolor }}>
          <Box color={bgcolor ? theme.palette.getContrastText(bgcolor) : undefined}>
            {nameInitials(name)}
          </Box>
        </Avatar>
      }
      sx={{ maxWidth: 160 }}
    />
  );
}
