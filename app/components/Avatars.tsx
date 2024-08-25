import { Avatar, Box, Chip, type SxProps } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import theme from '../utils/theme';

export function ClickableAvatar({
  name,
  title,
  href,
  onClick,
  size = 36,
  fontSize = 15,
  sx,
}: {
  name?: string;
  title?: string;
  href?: string;
  onClick?: (e: any) => void;
  size?: number;
  fontSize?: number;
  sx?: SxProps;
}) {
  return (
    <Avatar
      component={href ? 'a' : 'div'}
      title={title}
      href={href}
      onClick={onClick}
      sx={{
        bgcolor: stringColor(name),
        width: size,
        height: size,
        fontSize,
        ...(href && {
          cursor: 'pointer',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'none' },
        }),
        ...sx,
      }}
    >
      {nameInitials(name)}
    </Avatar>
  );
}

export function SmallAvatarChip({ name }: { name: string | undefined }) {
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
