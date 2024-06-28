import { Autocomplete, Box, InputBase } from '@mui/material';
import {
  useGridApiContext,
  type GridRenderEditCellParams,
  type MuiBaseEvent,
} from '@mui/x-data-grid';
import { useCallback, useState } from 'react';

export type SelectOption = { value: string; label?: string; color?: string | null };

export default function AutocompleteSelect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: GridRenderEditCellParams<any, SelectOption> & { options: SelectOption[] }
) {
  const { id, field, value, options } = props;
  const apiRef = useGridApiContext();
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = useCallback(
    async (event: MuiBaseEvent, value: SelectOption) => {
      await apiRef.current.setEditCellValue({ id, field, value }, event);
      apiRef.current.stopCellEditMode({ id, field });
    },
    [apiRef, field, id]
  );

  return (
    <Autocomplete<SelectOption, false, true /* disableClearable */, false>
      componentsProps={{ popper: { style: { width: 'fit-content' } } }}
      noOptionsText={'no match'}
      size="small"
      value={value}
      open={isOpen}
      onClose={() => setIsOpen(false)}
      onKeyDown={e => (e.key === 'Escape' ? setIsOpen(false) : null)}
      onChange={handleChange}
      options={options}
      getOptionLabel={(option: SelectOption) => option.label ?? ''}
      fullWidth
      disableClearable
      isOptionEqualToValue={(option, value) => option.value === value.value}
      renderOption={(optionProps, option: SelectOption) => (
        <Box
          component="li"
          fontSize="small"
          color={option.color ?? undefined}
          {...optionProps}
          sx={{ textWrap: 'nowrap' }}
        >
          {option.label}
        </Box>
      )}
      renderInput={params => (
        <InputBase
          autoFocus
          fullWidth
          size="small"
          id={params.id}
          inputProps={{
            ...params.inputProps,
            autoComplete: 'new-password', // disable autocomplete and autofill
          }}
          {...params.InputProps}
        />
      )}
    />
  );
}
