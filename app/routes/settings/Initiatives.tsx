import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { Alert, Box, Button, Stack } from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridDensity,
  GridRowId,
  GridRowModes,
  GridRowModesModel,
  GridRowsProp,
  GridSortDirection,
  GridToolbarContainer,
} from '@mui/x-data-grid';
import { useSubmit } from '@remix-run/react';
import { useConfirm } from 'material-ui-confirm';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SettingsData } from '~/schemas/schemas';
import { errMsg } from '~/utils/errorUtils';

interface InitiativeRow {
  id: string;
  key: string;
  label?: string;
  isNew?: boolean;
}

export default function Initiatives({ settingsData }: { settingsData: SettingsData }) {
  const submit = useSubmit();
  const confirm = useConfirm();

  const [rows, setRows] = useState<InitiativeRow[]>(
    settingsData.initiatives.map(initiative => {
      return { id: uuidv4(), key: initiative.id, label: initiative.label };
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

  interface EditToolbarProps {
    setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
    setRowModesModel: (newModel: (oldModel: GridRowModesModel) => GridRowModesModel) => void;
  }

  function EditToolbar(props: EditToolbarProps) {
    const { setRows, setRowModesModel } = props;

    const handleClick = () => {
      const id = uuidv4();
      setRows(oldRows => [...oldRows, { id, label: '', isNew: true }]);
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

  const handleDeleteClick = (id: GridRowId, iniativeKey: string) => {
    setRows(rows.filter(row => row.id !== id));
    submit({ delete: true, initiativeId: iniativeKey }, { method: 'post' });
  };

  const columns: GridColDef[] = [
    {
      field: 'key',
      headerName: 'Key',
      width: 120,
      editable: true,
      renderCell: params => {
        const key = params.value as string;
        return key ? key : <ReportProblemIcon fontSize="small" />;
      },
    },
    { field: 'label', headerName: 'Label', minWidth: 300, flex: 1, editable: true },
    {
      field: 'actions',
      type: 'actions',
      width: 100,
      cellClassName: 'actions',
      getActions: params => {
        const initiative = params.row as InitiativeRow;
        if (rowModesModel[params.id]?.mode === GridRowModes.Edit || !initiative.key) {
          return [];
        }
        return [
          <GridActionsCellItem
            key={1}
            icon={<DeleteIcon />}
            label="Delete"
            onClick={async () => {
              try {
                await confirm({
                  description: `Please confirm the deletion of initiative ${initiative.label}.`,
                });
                handleDeleteClick(params.id, initiative.key);
              } catch {
                /* user cancelled */
              }
            }}
            color="inherit"
          />,
        ];
      },
    },
  ];

  return (
    <Stack>
      <DataGrid
        columns={columns}
        rows={rows}
        {...dataGridProps}
        editMode="row"
        rowModesModel={rowModesModel}
        isCellEditable={params => {
          return (
            !!params.colDef.editable &&
            (params.colDef.field !== 'key' || !!(params.row as InitiativeRow).isNew)
          );
        }}
        onRowModesModelChange={handleRowModesModelChange}
        slots={{ toolbar: EditToolbar }}
        slotProps={{ toolbar: { setRows, setRowModesModel } }}
        processRowUpdate={(newRow: InitiativeRow) => {
          if (!newRow.key) {
            return newRow;
          }
          if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
            return { ...newRow, key: '' };
          }
          const updatedRow = { ...newRow, isNew: false };
          setRows(rows.map(row => (row.id === updatedRow.id ? updatedRow : row)));
          submit(
            { initiativeId: updatedRow.key, label: updatedRow.label ?? '' },
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
