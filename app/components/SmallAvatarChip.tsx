import { Avatar, Box, Chip } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import { getThemeContrastText } from '../utils/theme';

export default function SmallAvatarChip({ name }: { name: string | undefined }) {
  const bgcolor = stringColor(name);
  return (
    <Chip
      size="small"
      label={name ?? 'Unknown'}
      title={name}
      avatar={
        <Avatar sx={{ bgcolor }}>
          <Box color={getThemeContrastText(bgcolor)}>{nameInitials(name)}</Box>
        </Avatar>
      }
      sx={{ maxWidth: 160 }}
    />
  );
}
