import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  ReportProblem as ReportProblemIcon,
} from '@mui/icons-material';
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
  GridToolbarProps,
  ToolbarPropsOverrides,
} from '@mui/x-data-grid';
import { redirect, useFetcher, useLoaderData } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { JSXElementConstructor, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { fetchInitiatives } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';

const logger = pino({ name: 'route:initiatives' });

interface InitiativeRow {
  id: string;
  key: string;
  label?: string;
  isNew?: boolean;
}

export const meta = () => [{ title: 'Initiatives Admin | ROAKIT' }];

// verify JWT, load initiatives
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const initiatives = await fetchInitiatives(sessionData.customerId!);
    return { ...sessionData, initiatives };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

interface JsonRequest {
  initiativeId?: string;
  label?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const jsonRequest = (await request.json()) as JsonRequest;

  const initiativeId = jsonRequest.initiativeId!;
  if (!initiativeId) {
    return null;
  }

  if (request.method !== 'DELETE') {
    const label = jsonRequest.label!;
    const doc = firestore.doc(`customers/${sessionData.customerId!}/initiatives/${initiativeId}`);
    await doc.set({ label }, { merge: true });
  } else {
    const doc = firestore.doc(`customers/${sessionData.customerId!}/initiatives/${initiativeId}`);
    await doc.delete();

    const docs = await firestore
      .collection(`customers/${sessionData.customerId!}/activities/`)
      .where('event', '==', 'workflow_run')
      .get();
    const batch = firestore.batch();

    docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  return null;
};

export default function Initiatives() {
  const fetcher = useFetcher();
  const confirm = useConfirm();

  const sessionData = useLoaderData<typeof loader>();

  const [rows, setRows] = useState<InitiativeRow[]>(
    sessionData.initiatives.map(initiative => ({
      id: uuidv4(),
      key: initiative.id,
      label: initiative.label,
    }))
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
    sortingOrder: ['asc', 'desc'] as GridSortDirection[],
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

    const handleAddClick = () => {
      const id = uuidv4();
      setRows(oldRows => [...oldRows, { id, label: '', isNew: true }]);
      setRowModesModel(oldModel => ({
        ...oldModel,
        [id]: { mode: GridRowModes.Edit, fieldToFocus: 'key' },
      }));
    };

    return (
      <GridToolbarContainer>
        <Button color="primary" startIcon={<AddIcon />} onClick={handleAddClick}>
          Add initiative
        </Button>
      </GridToolbarContainer>
    );
  }

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const handleDeleteClick = (id: GridRowId, initiativeId: string) => {
    setRows(rows.filter(row => row.id !== id));
    fetcher.submit({ initiativeId }, deleteJsonOptions);
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
          />,
        ];
      },
    },
  ];

  return (
    <App isLoggedIn={true} view="initiatives" isNavOpen={sessionData.isNavOpen}>
      <Stack sx={{ m: 3 }}>
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
          slots={{
            toolbar: EditToolbar as JSXElementConstructor<GridToolbarProps & ToolbarPropsOverrides>,
          }}
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
            fetcher.submit(
              { initiativeId: updatedRow.key, label: updatedRow.label ?? '' },
              postJsonOptions
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
    </App>
  );
}
