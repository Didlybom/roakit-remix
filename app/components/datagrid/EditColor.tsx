import { Box, ClickAwayListener, Popper } from '@mui/material';
import { useGridApiContext, type GridRenderEditCellParams } from '@mui/x-data-grid';
import { useCallback, useState, type ChangeEvent } from 'react';
import type { ColorResult } from 'react-color';
import reactColor from 'react-color';
const { SwatchesPicker: ColorPicker } = reactColor;
// import { SwatchesPicker as ColorPicker } from 'react-color';

export function ColorValue({ color }: { color?: string }) {
  return (
    <Box
      width={40}
      height={20}
      border="solid 1px"
      sx={{ cursor: 'pointer', backgroundColor: color, opacity: color ? 1 : 0.3 }}
    />
  );
}

export default function EditColor(props: GridRenderEditCellParams<any, string>) {
  const { id, field, value } = props;
  const [valueState, setValueState] = useState(value);
  const [showPicker, setShowPicker] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>();
  const apiRef = useGridApiContext();

  const handleRef = useCallback((el: HTMLElement | null) => setAnchorEl(el), []);

  const handleChange = useCallback(
    async (color: ColorResult, event: ChangeEvent<HTMLInputElement>) => {
      setValueState(color.hex);
      setShowPicker(false);
      await apiRef.current.setEditCellValue({ id, field, value: color.hex }, event);
      apiRef.current.stopCellEditMode({ id, field });
    },
    [apiRef, field, id]
  );

  return (
    <Box display="flex" height="100%" alignItems="center" ml={1} ref={handleRef}>
      {anchorEl && (
        <Popper open={showPicker} anchorEl={anchorEl} placement="bottom-start">
          <ClickAwayListener onClickAway={() => setShowPicker(false)}>
            <ColorPicker color={valueState} onChange={handleChange} />
          </ClickAwayListener>
        </Popper>
      )}
      <Box onClick={() => setShowPicker(true)}>
        <ColorValue color={valueState} />
      </Box>
    </Box>
  );
}
