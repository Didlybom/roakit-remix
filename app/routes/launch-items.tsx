import {
  Cancel as CancelIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as DocumentationIcon,
  Edit as EditIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import { Box, Button, Snackbar, Stack, Typography, styled } from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridRowEditStopReasons,
  GridRowId,
  GridRowModes,
  GridRowModesModel,
  GridSortDirection,
  type GridEventListener,
  type GridSlots,
} from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { compileExpression } from 'filtrex';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { useEffect, useState } from 'react';
import App from '../components/App';
import EditTextarea from '../components/datagrid/EditTextarea';
import EditToolbar from '../components/datagrid/EditToolbar';
import { dataGridCommonProps } from '../components/datagrid/dataGridCommon';
import { firestore } from '../firebase.server';
import { fetchLaunchItems } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert, loaderErrorResponse } from '../utils/jsxUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:launch-items' });

interface LaunchItemRow {
  id: string;
  key: string;
  label?: string;
  isNew?: boolean;
  activityMapper?: string;
}

export const meta = () => [{ title: 'Launch Items Admin | ROAKIT' }];

const VIEW = View.LaunchItems;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const launchItems = await fetchLaunchItems(sessionData.customerId!);
    return { ...sessionData, launchItems };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

interface JsonRequest {
  launchItemId: string;
  key: string;
  label: string;
  activityMapper: string;
}

interface ActionResponse {
  status?: { code: 'saved' | 'deleted'; message?: string };
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadSession(request, VIEW);
  const jsonRequest = (await request.json()) as JsonRequest;
  const launchItemId = jsonRequest.launchItemId;

  if (request.method === 'DELETE') {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/launchItems/${launchItemId}`)
        .delete();
      return { status: { code: 'deleted', message: 'Launch item deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete launch item') };
    }
  } else {
    try {
      await firestore.doc(`customers/${sessionData.customerId!}/launchItems/${launchItemId}`).set(
        {
          key: jsonRequest.key,
          label: jsonRequest.label,
          activityMapper: jsonRequest.activityMapper,
        },
        { merge: true }
      );
      return { status: { code: 'saved', message: 'Launch item saved' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save launch item') };
    }
  }
};

const StyledBox = styled('div')(({ theme }) => ({
  '& .Mui-error': { backgroundColor: '#ffecf0', color: theme.palette.error.main },
}));

export default function LaunchItems() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const confirm = useConfirm();
  const [rows, setRows] = useState<LaunchItemRow[]>(
    loaderData.launchItems.map(launchItem => ({
      id: launchItem.id,
      key: launchItem.key ?? launchItem.id,
      label: launchItem.label,
      activityMapper: launchItem.activityMapper,
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
      return;
    }
    if (params.reason !== GridRowEditStopReasons.enterKeyDown) {
      return;
    }
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key && !keyEvent.ctrlKey && !keyEvent.metaKey) {
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

  const handleDeleteClick = (launchItemId: GridRowId) => {
    setRows(rows.filter(row => row.id !== launchItemId));
    submit({ launchItemId }, deleteJsonOptions);
  };

  const columns: GridColDef[] = [
    {
      field: 'key',
      headerName: 'Key',
      editable: true,
      preProcessEditCellProps: params => {
        return { ...params.props, error: !(params.props.value as string)?.trim() };
      },
    },
    { field: 'label', headerName: 'Label', editable: true },
    {
      field: 'activityMapper',
      headerName: 'Activity Mapper',
      flex: 1,
      editable: true,
      renderCell: params => (
        <Box
          title={params.value as string}
          fontFamily="Roboto Mono, monospace"
          fontSize="11px"
          sx={ellipsisSx}
        >
          {(params.value as string) ?? '...'}
        </Box>
      ),
      renderEditCell: params => <EditTextarea {...params} />,
      preProcessEditCellProps: params => {
        try {
          if (params.props.value) {
            compileExpression(params.props.value as string);
          }
          return { ...params.props, error: false };
        } catch (e) {
          return { ...params.props, error: true };
        }
      },
    },
    {
      field: 'actions',
      type: 'actions',
      cellClassName: 'actions',
      getActions: params => {
        const launchItem = params.row as LaunchItemRow;
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
                  description: `Please confirm the deletion of launch item "${launchItem.label || launchItem.key}".`,
                });
                handleDeleteClick(params.id);
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
        <StyledBox>
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
            slotProps={{
              toolbar: { labels: { add: 'New Launch Item' }, setRows, setRowModesModel },
            }}
            processRowUpdate={(newRow: LaunchItemRow) => {
              if (!newRow.key) {
                return newRow;
              }
              if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
                return { ...newRow, key: '' };
              }
              const updatedRow = { ...newRow, isNew: false };
              setRows(rows.map(row => (row.id === updatedRow.id ? updatedRow : row)));
              submit(
                {
                  launchItemId: updatedRow.id,
                  key: updatedRow.key,
                  label: updatedRow.label ?? '',
                  activityMapper: updatedRow.activityMapper ?? '',
                },
                postJsonOptions
              );
              return updatedRow;
            }}
            onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save launch item'))}
          />
        </StyledBox>
        <Typography variant="caption" mt={3} align="right">
          <Button
            href="https://github.com/joewalnes/filtrex/blob/master/README.md#expressions"
            target="_blank"
            startIcon={<DocumentationIcon fontSize="small" />}
            sx={{ textTransform: 'none' }}
          >
            Activity Mapper documentation
          </Button>
        </Typography>
      </Stack>
    </App>
  );
}
