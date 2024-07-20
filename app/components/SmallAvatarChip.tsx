import { Avatar, Box, Chip } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';

export default function smallAvatarChip({ name }: { name: string | undefined }) {
  return (
    <Chip
      size="small"
      label={name ?? 'Unknown'}
      title={name}
      avatar={
        <Avatar sx={{ bgcolor: stringColor(name) }}>
          <Box color="white">{nameInitials(name)}</Box>
        </Avatar>
      }
      sx={{ maxWidth: 160 }}
    />
  );
}
