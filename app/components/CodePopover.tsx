import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { IconButton, Popover, Stack, Typography } from '@mui/material';
import { formatJson } from '../utils/jsxUtils';
import theme from '../utils/theme';

export interface PopoverContent {
  element: HTMLElement;
  content: unknown;
}

export default function CodePopover({
  popover,
  onClose,
}: {
  popover: PopoverContent | null;
  onClose: () => void;
}) {
  if (!popover?.content) {
    return null;
  }
  const formattedContent = formatJson(popover.content);
  return (
    <Popover
      id={popover.element ? 'popover' : undefined}
      open={!!popover?.element}
      anchorEl={popover?.element}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Stack direction="row" sx={{ m: 1, position: 'absolute', top: 2, right: 0 }}>
        <IconButton onClick={() => void navigator.clipboard.writeText(formattedContent)}>
          <ContentCopyIcon />
        </IconButton>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Typography
        component="pre"
        fontSize="small"
        fontFamily="monospace"
        color={theme.palette.grey[700]}
        sx={{ p: 2, overflowX: 'auto' }}
      >
        {formattedContent}
      </Typography>
    </Popover>
  );
}
