import { Avatar, type SxProps } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';

export default function ClickableAvatar({
  name,
  title,
  href,
  size = 36,
  fontSize = 15,
  sx,
}: {
  name?: string;
  title?: string;
  href?: string;
  size?: number;
  fontSize?: number;
  sx?: SxProps;
}) {
  return (
    <Avatar
      component={href ? 'a' : 'div'}
      title={title}
      href={href}
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
