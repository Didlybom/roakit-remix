import { Avatar, type SxProps } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import { getThemeContrastText } from '../utils/theme';

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
  const bgcolor = stringColor(name);
  return (
    <Avatar
      component={href ? 'a' : 'div'}
      title={title}
      href={href}
      sx={{
        bgcolor: stringColor(name),
        color: getThemeContrastText(bgcolor),
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
