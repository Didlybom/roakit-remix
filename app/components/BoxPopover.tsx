import { Close as CloseIcon } from '@mui/icons-material';
import { Box, IconButton, Popover, type PopoverReference } from '@mui/material';

export interface BoxPopoverContent {
  element: HTMLElement;
  content: JSX.Element;
  showClose?: boolean;
}

export default function BoxPopover({
  popover,
  onClose,
  showClose = false,
  anchorReference = 'anchorEl',
}: {
  popover: BoxPopoverContent | null;
  onClose: () => void;
  showClose?: boolean;
  anchorReference?: PopoverReference;
}) {
  if (!popover?.content) {
    return null;
  }

  return (
    <Popover
      id={popover?.element ? 'popover' : undefined}
      open={!!popover?.element}
      onClose={onClose}
      anchorReference={anchorReference}
      anchorEl={anchorReference === 'anchorEl' ? popover?.element : undefined}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      sx={
        anchorReference ?
          { display: 'flex', justifyContent: 'center', alignItems: 'center' }
        : undefined
      }
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
