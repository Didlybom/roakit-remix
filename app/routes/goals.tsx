import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as DocumentationIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import type { GridColDef, GridEventListener, GridRowId, GridSortDirection } from '@mui/x-data-grid';
import { GridActionsCellItem, GridRowEditStopReasons } from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { compileExpression } from 'filtrex';
import { useConfirm } from 'material-ui-confirm';
import { useEffect, useState } from 'react';
import App from '../components/App';
import SmallChip from '../components/SmallChip';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import EditTextarea from '../components/datagrid/EditTextarea';
import { dataGridCommonProps } from '../components/datagrid/dataGridCommon';
import { firestore } from '../firebase.server';
import { fetchInitiatives } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert, loaderErrorResponse } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

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

const areRowsEqual = (a: InitiativeRow, b: InitiativeRow) =>
  a.key === b.key &&
  a.label === b.label &&
  a.reference === b.reference &&
  a.url === b.url &&
  a.tags === b.tags &&
  a.activityMapper === b.activityMapper;

export const meta = () => [{ title: 'Goals Admin | ROAKIT' }];

const VIEW = View.Initiatives;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const initiatives = await fetchInitiatives(sessionData.customerId!);
    return { ...sessionData, initiatives };
  } catch (e) {
    getLogger('route:initiatives').error(e);
    throw loaderErrorResponse(e);
  }
};

interface ActionRequest {
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
  const actionRequest = (await request.json()) as ActionRequest;
  const initiativeId = actionRequest.initiativeId;

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
      if (initiativeId) {
        await firestore
          .doc(`customers/${sessionData.customerId!}/initiatives/${initiativeId}`)
          .set(actionRequest, { merge: true });
      } else {
        await firestore
          .collection(`customers/${sessionData.customerId!}/initiatives`)
          .add(actionRequest);
      }
      return { status: { code: 'saved', message: 'Goal saved' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save goal') };
    }
  }
};

const StyledBox = styled('div')(({ theme }) => ({
  '& .Mui-error': { backgroundColor: '#ffecf0', color: theme.palette.error.main },
}));

export default function Initiatives() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const confirm = useConfirm();
  const [rows, setRows] = useState<InitiativeRow[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newReference, setNewReference] = useState('');
  const [newURL, setNewURL] = useState('');

  const [newActivityMapper, setNewActivityMapper] = useState('');
  const [newActivityMapperError, setNewActivityMapperError] = useState(false);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(
      loaderData.initiatives.map(initiative => ({
        ...initiative,
        key: initiative.key ?? initiative.id,
        tags: initiative.tags ? initiative.tags.sort().join(', ') : '',
      }))
    );
  }, [loaderData.initiatives]);

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

  const handleDeleteClick = (initiativeId: GridRowId) => {
    setRows(rows.filter(row => row.id !== initiativeId));
    submit({ initiativeId }, deleteJsonOptions);
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
      field: 'tags',
      headerName: 'Tags',
      editable: true,
      renderCell: params => {
        return params.value ?
            <Box tabIndex={params.tabIndex} display="flex" height="100%" alignItems="center">
              {splitTags(params.value as string).map((tag, i) => (
                <SmallChip key={i} label={tag} sx={{ mr: '4px' }} />
              ))}
            </Box>
          : null;
      },
    },
    {
      field: 'reference',
      headerName: 'Reference',
      editable: true,
    },
    {
      field: 'url',
      headerName: 'URL',
      editable: true,
      renderCell: params => {
        return params.value ?
            <IconButton
              tabIndex={params.tabIndex}
              href={params.value as string}
              target="_blank"
              sx={{ ml: -1 }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          : null;
      },
    },
    {
      field: 'activityMapper',
      headerName: 'Activity Mapper',
      flex: 1,
      editable: true,
      sortable: false,
      renderCell: params => (
        <Box
          tabIndex={params.tabIndex}
          title={params.value as string}
          fontFamily="Roboto Mono, monospace"
          fontSize="11px"
          sx={ellipsisSx}
        >
          {(params.value as string) || '⋯'}
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
        return [
          <GridActionsCellItem
            key={1}
            icon={<DeleteIcon />}
            label="Delete"
            onClick={async () => {
              try {
                await confirm({
                  description: `Please confirm the deletion of goal "${initiative.label || initiative.key}".`,
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

  useEffect(() => {
    try {
      if (newActivityMapper) {
        compileExpression(newActivityMapper);
      }
    } catch (e) {
      setNewActivityMapperError(true);
      return;
    }
    setNewActivityMapperError(false);
  }, [newActivityMapper]);

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
        onClose={(_, reason?: string) => (reason === 'clickaway' ? null : setConfirmation(''))}
        message={confirmation}
      />
      <Dialog
        open={showNewDialog}
        fullWidth
        onClose={() => setShowNewDialog(false)}
        disableRestoreFocus
      >
        <DialogTitle>New Launch Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} my={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                autoFocus
                required
                autoComplete="off"
                label="Key"
                size="small"
                fullWidth
                onChange={e => setNewKey(e.target.value)}
              />
            </Stack>
            <TextField
              required
              autoComplete="off"
              label="Label"
              size="small"
              fullWidth
              onChange={e => setNewLabel(e.target.value)}
            />
            <TextField
              autoComplete="off"
              label="Tags"
              size="small"
              fullWidth
              onChange={e => setNewTags(e.target.value)}
              helperText="tag1, tag2, tag3"
            />
            <TextField
              autoComplete="off"
              label="Reference"
              size="small"
              fullWidth
              onChange={e => setNewReference(e.target.value)}
            />
            <TextField
              autoComplete="off"
              label="URL"
              size="small"
              fullWidth
              onChange={e => setNewURL(e.target.value)}
            />
            <TextField
              autoComplete="off"
              label="Activity Mapper"
              size="small"
              multiline
              rows={2}
              fullWidth
              inputProps={{ style: { fontFamily: 'Roboto Mono, monospace', fontSize: '11px' } }}
              onChange={e => setNewActivityMapper(e.target.value)}
              error={newActivityMapperError}
              helperText={
                <Box display="flex" justifyContent="end">
                  <Button
                    href="https://github.com/joewalnes/filtrex/blob/master/README.md#expressions"
                    target="_blank"
                    startIcon={<DocumentationIcon />}
                    sx={{ fontSize: '11px', fontWeight: 400, textTransform: 'none' }}
                  >
                    Activity Mapper documentation
                  </Button>
                </Box>
              }
            />
          </Stack>
          <DialogActions>
            <Button onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={!newKey.trim() || !newLabel.trim() || newActivityMapperError}
              onClick={() => {
                setShowNewDialog(false);
                const tags = newTags ? [...new Set(splitTags(newTags))] : null;
                submit(
                  {
                    key: newKey,
                    label: newLabel,
                    tags,
                    reference: newReference,
                    url: newURL,
                    activityMapper: newActivityMapper,
                  },
                  postJsonOptions
                );
              }}
            >
              Save
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Stack m={3}>
        <Button
          onClick={() => {
            setNewActivityMapperError(false);
            setShowNewDialog(true);
          }}
          startIcon={<AddIcon />}
          sx={{ width: 'fit-content' }}
        >
          New Goal
        </Button>
        <StyledBox>
          <DataGridWithSingleClickEditing
            columns={columns}
            rows={rows}
            {...dataGridCommonProps}
            rowHeight={50}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'key', sort: 'asc' as GridSortDirection }] },
            }}
            onRowEditStop={handleRowEditStop}
            processRowUpdate={(newRow: InitiativeRow, oldRow: InitiativeRow) => {
              if (!newRow.key) {
                return newRow;
              }
              if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
                return { ...newRow, key: '' };
              }
              const tags = newRow.tags ? [...new Set(splitTags(newRow.tags))] : null;
              const updatedRow = { ...newRow, tags: tags?.join(', ') ?? '', isNew: false };
              if (areRowsEqual(newRow, oldRow)) {
                return updatedRow;
              }
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
            startIcon={<DocumentationIcon />}
            sx={{ fontSize: '11px', fontWeight: 400, textTransform: 'none' }}
          >
            Activity Mapper documentation
          </Button>
        </Typography>
      </Stack>
    </App>
  );
}
