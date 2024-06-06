import { InputBase, Paper, Popper, type InputBaseProps } from '@mui/material';
import { useGridApiContext, type GridRenderEditCellParams } from '@mui/x-data-grid';
import { useCallback, useLayoutEffect, useState } from 'react';
import theme from '../../utils/theme';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EditTextarea(props: GridRenderEditCellParams<any, string>) {
  const { id, field, value, colDef, hasFocus, error } = props;
  const [valueState, setValueState] = useState(value);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>();
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);
  const apiRef = useGridApiContext();

  useLayoutEffect(() => {
    if (hasFocus && inputRef) {
      inputRef.focus();
    }
  }, [hasFocus, inputRef]);

  const handleRef = useCallback((el: HTMLElement | null) => {
    setAnchorEl(el);
  }, []);

  const handleChange = useCallback<NonNullable<InputBaseProps['onChange']>>(
    async event => {
      const newValue = event.target.value;
      setValueState(newValue);
      await apiRef.current.setEditCellValue({ id, field, value: newValue, debounceMs: 200 }, event);
    },
    [apiRef, field, id]
  );

  return (
    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <div
        ref={handleRef}
        style={{
          height: 1,
          width: colDef.computedWidth,
          display: 'block',
          position: 'absolute',
          top: 0,
        }}
      />
      {anchorEl && (
        <Popper open anchorEl={anchorEl} placement="bottom-start">
          <Paper elevation={1} sx={{ p: 1, minWidth: colDef.computedWidth }}>
            <InputBase
              multiline
              rows={4}
              value={valueState}
              sx={{
                textarea: { resize: 'both' },
                width: '100%',
                fontFamily: 'Roboto Mono, monospace',
                fontSize: '11px',
                color: error ? theme.palette.error.main : undefined,
              }}
              onChange={handleChange}
              inputRef={(ref: HTMLInputElement) => setInputRef(ref)}
            />
          </Paper>
        </Popper>
      )}
    </div>
  );
}
