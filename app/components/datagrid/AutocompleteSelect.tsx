import { Autocomplete, Box, InputBase } from '@mui/material';
import {
  useGridApiContext,
  type GridRenderEditCellParams,
  type MuiBaseEvent,
} from '@mui/x-data-grid';
import { useCallback } from 'react';
import type { SelectOption } from '../../utils/jsxUtils';

export default function AutocompleteSelect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: GridRenderEditCellParams<any, string> & { options: SelectOption[] }
) {
  const { id, field, value, options } = props;
  const optionValue = { value: value ?? '' };
  const apiRef = useGridApiContext();

  const handleChange = useCallback(
    async (event: MuiBaseEvent, optionValue: SelectOption) => {
      await apiRef.current.setEditCellValue({ id, field, value: optionValue.value }, event);
      apiRef.current.stopCellEditMode({ id, field });
    },
    [apiRef, field, id]
  );

  const handleClose = useCallback(() => {
    apiRef.current.stopCellEditMode({ id, field, ignoreModifications: true });
  }, [apiRef, field, id]);

  return (
    <Autocomplete<SelectOption, false, true /* disableClearable */, false>
      componentsProps={{ popper: { style: { width: 'fit-content' } } }}
      noOptionsText={<Box fontSize="small">no match</Box>}
      size="small"
      value={optionValue}
      open={true}
      onClose={handleClose}
      onKeyDown={e => (e.key === 'Escape' ? handleClose() : null)}
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
          onFocus={e => e.target.select()}
          fullWidth
          size="small"
          id={params.id}
          inputProps={{
            ...params.inputProps,
            autoComplete: 'new-password', // disable autocomplete and autofill
          }}
          {...params.InputProps}
          sx={{ pl: '4px', fontSize: 'small' }}
        />
      )}
    />
  );
}
