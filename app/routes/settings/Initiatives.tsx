import AddIcon from '@mui/icons-material/Add';
import { Alert, Box, Button, Stack } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridDensity,
  GridRowModes,
  GridRowModesModel,
  GridRowsProp,
  GridSortDirection,
  GridToolbarContainer,
  useGridApiRef,
} from '@mui/x-data-grid';
import { useSubmit } from '@remix-run/react';
import { useMemo, useState } from 'react';
import { SettingsData } from '~/schemas/schemas';
import { errMsg } from '~/utils/errorUtils';

interface Initiative {
  id: number;
  key: string;
  label?: string;
}

export default function Initiatives({ settingsData }: { settingsData: SettingsData }) {
  const submit = useSubmit();
  const gridApi = useGridApiRef();

  const [rows, setRows] = useState<Initiative[]>(
    settingsData.initiatives.map((initiative, i) => {
      return { id: i, key: initiative.id, label: initiative.label };
    })
  );
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});

  const [error, setError] = useState('');

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
      { field: 'key', headerName: 'Key', width: 100, editable: true },
      { field: 'label', headerName: 'Label', minWidth: 300, flex: 1, editable: true },
    ],
    []
  );

  interface EditToolbarProps {
    setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
    setRowModesModel: (newModel: (oldModel: GridRowModesModel) => GridRowModesModel) => void;
  }

  function EditToolbar(props: EditToolbarProps) {
    const { setRows, setRowModesModel } = props;

    const handleClick = () => {
      const id = rows.length + 1;
      setRows(oldRows => [...oldRows, { id, label: '' }]);
      setRowModesModel(oldModel => ({
        ...oldModel,
        [id]: { mode: GridRowModes.Edit, fieldToFocus: 'key' },
      }));
    };

    return (
      <GridToolbarContainer>
        <Button color="primary" startIcon={<AddIcon />} onClick={handleClick}>
          Add initiative
        </Button>
      </GridToolbarContainer>
    );
  }

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  return (
    <Stack>
      <DataGrid
        columns={columns}
        rows={rows}
        {...dataGridProps}
        editMode="row"
        rowModesModel={rowModesModel}
        onRowModesModelChange={handleRowModesModelChange}
        slots={{ toolbar: EditToolbar }}
        slotProps={{ toolbar: { setRows, setRowModesModel } }}
        apiRef={gridApi}
        processRowUpdate={(updatedRow: Initiative) => {
          console.log(updatedRow);
          setRows(rows.map(row => (row.id === updatedRow.id ? updatedRow : row)));
          if (!updatedRow.key) {
            return updatedRow;
          }
          submit(
            {
              initiativeId: updatedRow.key,
              label: updatedRow.label ?? '',
            },
            { method: 'post' }
          );
          return updatedRow;
        }}
        onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save initiative'))}
      />
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
