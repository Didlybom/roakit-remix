import { Typography } from '@mui/material';
import memoize from 'fast-memoize';
import pluralize from 'pluralize';
import { ellipsisSx } from '../../utils/jsxUtils';

export const pluralizeMemo = memoize(pluralize);

export const commonPaperSx = ({ isLoading = false }: { isLoading?: boolean }) => ({
  width: 320,
  p: 1,
  opacity: isLoading ? 0.4 : 1,
});

export const widgetSize = { width: 300, height: 260 };

export const widgetTitle = (title: string) => (
  <Typography
    fontSize="14px"
    mb="2"
    borderBottom="solid 1px rgba(0, 0, 0, 0.12)"
    whiteSpace="noWrap"
    sx={ellipsisSx}
  >
    {title}
  </Typography>
);

export const pastelColors = [
  '#8bd3c7',
  '#beb9db',
  '#fd7f6f',
  '#7eb0d5',
  '#b2e061',
  '#bd7ebe',
  '#ffb55a',
  '#ffee65',
  '#fdcce5',
];
