import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { IconButton, Popover, Stack, Typography } from '@mui/material';

export interface PopoverContent {
  element: HTMLElement;
  content: string;
}

export default function CodePopover({
  popover,
  onClose,
}: {
  popover: PopoverContent | null;
  onClose: () => void;
}) {
  return (
    !!popover?.content && (
      <Popover
        id={popover.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction="row" sx={{ m: 1, float: 'right' }}>
          <IconButton>
            <ContentCopyIcon onClick={() => void navigator.clipboard.writeText(popover.content)} />
          </IconButton>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography
          component="pre"
          fontSize="small"
          fontFamily="monospace"
          color="GrayText"
          sx={{ p: 2 }}
        >
          {popover.content}
        </Typography>
      </Popover>
    )
  );
}
