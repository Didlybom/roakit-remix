import {
  Add as AddIcon,
  Cancel as CancelIcon,
  DeleteOutlined as DeleteIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  ReportProblem as ReportProblemIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import { Button, IconButton, Snackbar, Stack } from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridRowEditStopReasons,
  GridRowId,
  GridRowModes,
  GridRowModesModel,
  GridRowsProp,
  GridSortDirection,
  GridToolbarContainer,
  type GridEventListener,
  type GridSlots,
} from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { fetchInitiatives } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { dataGridCommonProps } from '../utils/dataGridUtils';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import { errorAlert } from '../utils/jsxUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:initiatives' });

interface InitiativeRow {
  id: string;
  key: string;
  label?: string;
  isNew?: boolean;
  reference?: string;
  url?: string;
  tags?: string;
}

export const meta = () => [{ title: 'Goals Admin | ROAKIT' }];

const VIEW = View.Initiatives;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const initiatives = await fetchInitiatives(sessionData.customerId!);
    return { ...sessionData, initiatives };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

interface JsonRequest {
  initiativeId: string;
  key: string;
  label: string;
  tags?: string[];
  reference: string;
  url: string;
}

interface ActionResponse {
  status?: { code: 'saved' | 'deleted'; message?: string };
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadSession(request, VIEW);
  const jsonRequest = (await request.json()) as JsonRequest;
  const initiativeId = jsonRequest.initiativeId;

  if (request.method === 'DELETE') {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/initiatives/${initiativeId}`)
        .delete();
      return { status: { code: 'deleted', message: 'Goal deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete goal') };
    }
  } else {
    try {
      await firestore.doc(`customers/${sessionData.customerId!}/initiatives/${initiativeId}`).set(
        {
          key: jsonRequest.key,
          label: jsonRequest.label,
          tags: jsonRequest.tags,
          reference: jsonRequest.reference,
          url: jsonRequest.url,
        },
        { merge: true }
      );
      return { status: { code: 'saved', message: 'Goal saved' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save goal') };
    }
  }
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
        Add goal
      </Button>
    </GridToolbarContainer>
  );
}

export default function Initiatives() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const confirm = useConfirm();
  const [rows, setRows] = useState<InitiativeRow[]>(
    loaderData.initiatives.map(initiative => ({
      id: initiative.id,
      key: initiative.key ?? initiative.id,
      label: initiative.label,
      tags: initiative.tags ? initiative.tags.sort().join(', ') : '',
      reference: initiative.reference,
      url: initiative.url,
    }))
  );
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [confirmation, setConfirmation] = useState('false');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
    }
  }, [actionData?.status]);

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const handleEditClick = (id: GridRowId) => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleCancelClick = (id: GridRowId) => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
    const editedRow = rows.find(row => row.id === id);
    if (editedRow!.isNew) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleDeleteClick = (id: GridRowId, initiativeId: string) => {
    setRows(rows.filter(row => row.id !== id));
    submit({ initiativeId }, deleteJsonOptions);
  };

  const columns: GridColDef[] = [
    {
      field: 'key',
      headerName: 'Key',
      minWidth: 120,
      editable: true,
      renderCell: params => {
        const key = params.value as string;
        return key || <ReportProblemIcon fontSize="small" />;
      },
    },
    { field: 'label', headerName: 'Label', minWidth: 300, flex: 1, editable: true },
    { field: 'tags', headerName: 'Tags', minWidth: 300, editable: true },
    {
      field: 'reference',
      headerName: 'Reference',
      minWidth: 120,
      editable: true,
    },
    {
      field: 'url',
      headerName: 'URL',
      minWidth: 200,
      editable: true,
      renderCell: params => {
        return params.value ?
            <IconButton href={params.value as string} target="_blank">
              <LinkIcon fontSize="small" />
            </IconButton>
          : null;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      cellClassName: 'actions',
      getActions: params => {
        const initiative = params.row as InitiativeRow;
        if (rowModesModel[params.id]?.mode === GridRowModes.Edit) {
          return [
            <GridActionsCellItem
              key={1}
              icon={<SaveIcon />}
              label="Save"
              sx={{ color: 'primary.main' }}
              onClick={() => handleSaveClick(params.id)}
            />,
            <GridActionsCellItem
              key={2}
              icon={<CancelIcon />}
              label="Cancel"
              className="textPrimary"
              onClick={() => handleCancelClick(params.id)}
              color="inherit"
            />,
          ];
        }
        return [
          <GridActionsCellItem
            key={1}
            icon={<EditIcon />}
            label="Edit"
            className="textPrimary"
            onClick={() => handleEditClick(params.id)}
            color="inherit"
          />,
          <GridActionsCellItem
            key={2}
            icon={<DeleteIcon />}
            label="Delete"
            onClick={async () => {
              try {
                await confirm({
                  description: `Please confirm the deletion of initiative ${initiative.label || initiative.key}.`,
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
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle'}
    >
      {errorAlert(actionData?.error)}
      {errorAlert(error)}
      <Snackbar
        open={!!confirmation}
        autoHideDuration={3000}
        onClose={(_, reason?: string) => {
          if (reason === 'clickaway') {
            return;
          }
          setConfirmation('');
        }}
        message={confirmation}
      />
      <Stack sx={{ m: 3 }}>
        <DataGrid
          columns={columns}
          rows={rows}
          {...dataGridCommonProps}
          rowHeight={50}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'id', sort: 'asc' as GridSortDirection }] },
          }}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={handleRowModesModelChange}
          onRowEditStop={handleRowEditStop}
          slots={{ toolbar: EditToolbar as GridSlots['toolbar'] }}
          slotProps={{ toolbar: { setRows, setRowModesModel } }}
          processRowUpdate={(newRow: InitiativeRow) => {
            if (!newRow.key) {
              return newRow;
            }
            if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
              return { ...newRow, key: '' };
            }
            const tags =
              newRow.tags ?
                [
                  ...new Set(
                    newRow.tags
                      .split(',')
                      .map(t => t.trim())
                      .map(t => (t.startsWith('#') ? t : `#${t}`))
                      .filter(t => t !== '#')
                      .sort()
                  ),
                ]
              : null;
            const updatedRow = { ...newRow, tags: tags?.join(', ') ?? '', isNew: false };
            setRows(rows.map(row => (row.id === updatedRow.id ? updatedRow : row)));
            submit(
              {
                initiativeId: updatedRow.id,
                key: updatedRow.key,
                label: updatedRow.label ?? '',
                tags,
                reference: updatedRow.reference ?? '',
                url: updatedRow.url ?? '',
              },
              postJsonOptions
            );
            return updatedRow;
          }}
          onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save goal'))}
        />
      </Stack>
    </App>
  );
}
