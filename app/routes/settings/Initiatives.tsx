import AddIcon from '@mui/icons-material/Add';
import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridDensity,
  GridSortDirection,
  useGridApiRef,
} from '@mui/x-data-grid';
import { useSubmit } from '@remix-run/react';
import { useMemo, useState } from 'react';
import { InitiativeData, SettingsData } from '~/schemas/schemas';
import { errMsg } from '~/utils/errorUtils';
import {} from './route';

export default function Initiatives({ settingsData }: { settingsData: SettingsData }) {
  const submit = useSubmit();
  const gridApi = useGridApiRef();

  const initiatives = settingsData.initiatives;
  const [error, setError] = useState('');

  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const dataGridProps = {
    autoHeight: true, // otherwise empty state looks ugly
    slots: {
      noRowsOverlay: () => (
        <Box height="75px" display="flex" alignItems="center" justifyContent="center">
          Nothing to show
        </Box>
      ),
    },
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    pageSizeOptions: [25, 50, 100],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'id', sort: 'asc' as GridSortDirection }] },
    },
  };

  const columns = useMemo<GridColDef[]>(
    () => [
      { field: 'id', headerName: 'Key', width: 100 },
      { field: 'label', headerName: 'Label', minWidth: 300, flex: 1, editable: true },
    ],
    []
  );

  return (
    <Stack>
      <DataGrid
        columns={columns}
        rows={initiatives}
        {...dataGridProps}
        apiRef={gridApi}
        processRowUpdate={(updatedRow: InitiativeData) => {
          submit(
            {
              initiativeId: updatedRow.id,
              label: updatedRow.label ?? '',
            },
            { method: 'post' }
          );
          return updatedRow;
        }}
        onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save initiative'))}
      ></DataGrid>
      <Box
        component="form"
        sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}
        noValidate
        autoComplete="off"
      >
        <TextField
          id="key"
          required
          label="Key"
          size="small"
          sx={{ m: 1, width: '15ch' }}
          onChange={e => setNewKey(e.target.value)}
        />
        <TextField
          id="label"
          label="Label"
          size="small"
          sx={{ m: 1, width: 'ch' }}
          onChange={e => setNewLabel(e.target.value)}
        />
        <Button
          onClick={() => {
            if (!newKey) return;
            submit({ initiativeId: newKey, label: newLabel }, { method: 'post' });
          }}
          disabled={!newKey || !!initiatives.find(i => i.id === newKey)}
          startIcon={<AddIcon />}
          variant="contained"
          size="small"
          color="secondary"
          sx={{ m: 1, textWrap: 'nowrap' }}
        >
          Add
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {' '}
          {error}
        </Alert>
      )}
    </Stack>
  );
}
