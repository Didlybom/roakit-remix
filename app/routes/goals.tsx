import {
  Add as AddIcon,
  Cancel as CancelIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as DocumentationIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Paper,
  Popper,
  Snackbar,
  Stack,
  Typography,
  styled,
  type InputBaseProps,
} from '@mui/material';
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
  useGridApiContext,
  type GridEventListener,
  type GridRenderEditCellParams,
  type GridSlots,
} from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { compileExpression } from 'filtrex';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { fetchInitiatives } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { dataGridCommonProps } from '../utils/dataGridUtils';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert } from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import theme from '../utils/theme';

const logger = pino({ name: 'route:initiatives' });

interface InitiativeRow {
  id: string;
  key: string;
  label?: string;
  isNew?: boolean;
  reference?: string;
  url?: string;
  tags?: string;
  activityMapper?: string;
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
  activityMapper: string;
}

interface ActionResponse {
  status?: { code: 'saved' | 'deleted'; message?: string };
  error?: string;
}

const splitTags = (value: string) =>
  value
    .split(',')
    .map(t => t.trim())
    .map(t => (t.startsWith('#') ? t : `#${t}`))
    .filter(t => t !== '#')
    .sort();

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
          activityMapper: jsonRequest.activityMapper,
        },
        { merge: true }
      );
      return { status: { code: 'saved', message: 'Goal saved' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save goal') };
    }
  }
};

const StyledBox = styled('div')(({ theme }) => ({
  '& .Mui-error': { backgroundColor: '#ffecf0', color: theme.palette.error.main },
}));

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditTextarea(props: GridRenderEditCellParams<any, string>) {
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
      activityMapper: initiative.activityMapper,
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

  const handleDeleteClick = (initiativeId: GridRowId) => {
    setRows(rows.filter(row => row.id !== initiativeId));
    submit({ initiativeId }, deleteJsonOptions);
  };

  const columns: GridColDef[] = [
    {
      field: 'key',
      headerName: 'Key',
      minWidth: 120,
      editable: true,
      preProcessEditCellProps: params => {
        return { ...params.props, error: !(params.props.value as string)?.trim() };
      },
    },
    { field: 'label', headerName: 'Label', minWidth: 300, flex: 1, editable: true },
    {
      field: 'tags',
      headerName: 'Tags',
      minWidth: 300,
      editable: true,
      renderCell: params => {
        return params.value ?
            <Box display="flex" height="100%" alignItems="center">
              {splitTags(params.value as string).map((tag, i) => (
                <Chip
                  key={i}
                  variant="outlined"
                  size="small"
                  label={tag}
                  sx={{ fontSize: '10px', mr: '4px' }}
                />
              ))}
            </Box>
          : null;
      },
    },
    {
      field: 'reference',
      headerName: 'Reference',
      minWidth: 120,
      editable: true,
    },
    {
      field: 'url',
      headerName: 'URL',
      minWidth: 120,
      editable: true,
      renderCell: params => {
        return params.value ?
            <IconButton href={params.value as string} target="_blank" sx={{ ml: -1 }}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          : null;
      },
    },
    {
      field: 'activityMapper',
      headerName: 'Activity Mapper',
      minWidth: 300,
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
            slotProps={{ toolbar: { setRows, setRowModesModel } }}
            processRowUpdate={(newRow: InitiativeRow) => {
              if (!newRow.key) {
                return newRow;
              }
              if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
                return { ...newRow, key: '' };
              }
              const tags = newRow.tags ? [...new Set(splitTags(newRow.tags))] : null;
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
                  activityMapper: updatedRow.activityMapper ?? '',
                },
                postJsonOptions
              );
              return updatedRow;
            }}
            onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save goal'))}
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
