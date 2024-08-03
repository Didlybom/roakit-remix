import { Avatar, Box, Chip } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import theme from '../utils/theme';

export default function SmallAvatarChip({ name }: { name: string | undefined }) {
  return (
    <Chip
      size="small"
      label={name ?? 'Unknown'}
      avatar={
        <Avatar sx={{ bgcolor: stringColor(name) }}>
          <Box color={theme.palette.common.white}>{nameInitials(name)}</Box>
        </Avatar>
      }
      sx={{ maxWidth: 160 }}
    />
  );
}
