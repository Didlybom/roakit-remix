import { Avatar, type SxProps } from '@mui/material';
import { nameInitials, stringColor } from '../utils/stringUtils';
import theme from '../utils/theme';

export default function ClickableAvatar({
  title,
  name,
  href,
  size = 36,
  fontSize = 15,
  sx,
}: {
  title?: string;
  name?: string;
  href?: string;
  size?: number;
  fontSize?: number;
  sx?: SxProps;
}) {
  const bgcolor = stringColor(name);
  return (
    <Avatar
      component="a"
      title={title}
      href={href}
      sx={{
        bgcolor: stringColor(name),
        color: bgcolor ? theme.palette.getContrastText(bgcolor) : undefined,
        cursor: href ? 'pointer' : undefined,
        width: size,
        height: size,
        fontSize,
        textDecoration: 'none',
        ...sx,
      }}
    >
      {nameInitials(name)}
    </Avatar>
  );
}
