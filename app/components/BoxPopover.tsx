import { Close as CloseIcon } from '@mui/icons-material';
import { Box, IconButton, Popover } from '@mui/material';

export interface BoxPopoverContent {
  element: HTMLElement;
  content: JSX.Element;
  showClose?: boolean;
}

export default function BoxPopover({
  popover,
  onClose,
  showClose = false,
}: {
  popover: BoxPopoverContent | null;
  onClose: () => void;
  showClose?: boolean;
}) {
  if (!popover?.content) {
    return null;
  }

  return (
    <Popover
      id={popover?.element ? 'popover' : undefined}
      open={!!popover?.element}
      anchorEl={popover?.element}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <>
        {showClose && (
          <Box sx={{ m: 1, position: 'absolute', top: 2, right: 0, zIndex: 2 }}>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        )}
        <Box p={1}>{popover.content}</Box>
      </>
    </Popover>
  );
}
