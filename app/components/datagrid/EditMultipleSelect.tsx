import { type SelectChangeEvent, Checkbox, MenuItem, Select } from '@mui/material';
import { type GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid';
import { useCallback, useState } from 'react';
import type { SelectOption } from '../../utils/jsxUtils';

export default function EditMultipleSelect(
  props: GridRenderEditCellParams<any, string[]> & { options: SelectOption[] }
) {
  const { id, field, value, options } = props;
  const apiRef = useGridApiContext();
  const [open, setOpen] = useState(true);

  const handleChange = useCallback(
    async (event: SelectChangeEvent<string[]>) =>
      await apiRef.current.setEditCellValue({ id, field, value: event.target.value }, event),
    [apiRef, field, id]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    apiRef.current.stopCellEditMode({ id, field });
  }, [apiRef, field, id]);

  const findLabel = (value: string) => options.find(o => o.value === value)?.label ?? 'unknown';

  return (
    <Select
      multiple
      open={open}
      value={value ?? []}
      onChange={handleChange}
      onClose={handleClose}
      sx={{ width: '100%' }}
      renderValue={value => value.map(v => findLabel(v)).join(', ')}
    >
      {options.map((option, i) => (
        <MenuItem key={i} dense value={option.value}>
          <Checkbox size="small" checked={value?.includes(option.value)} />
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}
