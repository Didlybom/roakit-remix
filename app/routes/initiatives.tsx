import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as DocumentationIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  GridColDef,
  GridEventListener,
  GridPreProcessEditCellProps,
  GridRenderCellParams,
  GridRowId,
  GridRowParams,
  GridSortDirection,
} from '@mui/x-data-grid';
import { GridActionsCellItem, GridRowEditStopReasons } from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { compileExpression } from 'filtrex';
import { useConfirm } from 'material-ui-confirm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import reactColor from 'react-color';
// import { SwatchesPicker as ColorPicker } from 'react-color';
import App from '../components/App';
import type { BoxPopoverContent } from '../components/BoxPopover';
import BoxPopover from '../components/BoxPopover';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import EditColor, { ColorValue } from '../components/datagrid/EditColor';
import EditTextarea from '../components/datagrid/EditTextarea';
import { dataGridCommonProps, StyledMuiError } from '../components/datagrid/dataGridCommon';
import { fetchInitiatives } from '../firestore.server/fetchers.server';
import { deleteInitiative, upsertInitiative } from '../firestore.server/updaters.server';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert, loaderErrorResponse } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
const { SwatchesPicker: ColorPicker } = reactColor;

interface InitiativeRow {
  id: string;
  key: string;
  label?: string;
  color?: string | null;
  isNew?: boolean;
  activityMapper?: string;
}

const areRowsEqual = (a: InitiativeRow, b: InitiativeRow) =>
  a.key === b.key &&
  a.label === b.label &&
  a.color === b.color &&
  a.activityMapper === b.activityMapper;

export const meta = () => [{ title: 'Initiatives Admin | ROAKIT' }];

const VIEW = View.Initiatives;

const DEFAULT_COLOR = '#607d8b';
const KEY_REGEXP = new RegExp(/^[A-Z][A-Z_]*[A-Z]$/);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW);
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
  color: string | null;
  activityMapper: string;
}

interface ActionResponse {
  status?: { code: 'saved' | 'deleted'; message?: string };
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadAndValidateSession(request, VIEW);
  const actionRequest = (await request.json()) as ActionRequest;
  const initiativeId = actionRequest.initiativeId;

  if (request.method === 'DELETE') {
    try {
      await deleteInitiative(sessionData.customerId!, initiativeId);
      return { status: { code: 'deleted', message: 'Initiative deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete initiative') };
    }
  }

  try {
    const { initiativeId: id, ...fields } = actionRequest;
    await upsertInitiative(sessionData.customerId!, { id, ...fields });
    return { status: { code: 'saved', message: 'Initiative saved' } };
  } catch (e) {
    return { error: errMsg(e, 'Failed to save initiative') };
  }
};

export default function Initiatives() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const confirm = useConfirm();
  const [rows, setRows] = useState<InitiativeRow[]>([]);
  const [colorPickerPopover, setShowColorPickerPopover] = useState<BoxPopoverContent | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLOR);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLDivElement | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newActivityMapper, setNewActivityMapper] = useState('');
  const [newActivityMapperError, setNewActivityMapperError] = useState(false);
  const [newKeyError, setNewKeyError] = useState(false);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(
      loaderData.initiatives.map(initiative => ({
        ...initiative,
        key: initiative.key ?? initiative.id,
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

  useEffect(() => {
    try {
      if (newActivityMapper) compileExpression(newActivityMapper);
    } catch (e) {
      return setNewActivityMapperError(true);
    }
    setNewActivityMapperError(false);
  }, [newActivityMapper]);

  useEffect(
    () =>
      setNewKeyError((!!newKey && !KEY_REGEXP.exec(newKey)) || rows.some(r => r.key === newKey)),
    [newKey, rows]
  );

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

  const handleDeleteClick = useCallback(
    (initiativeId: GridRowId) => {
      setRows(rows.filter(row => row.id !== initiativeId));
      submit({ initiativeId }, deleteJsonOptions);
    },
    [rows, submit]
  );

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'key',
        headerName: 'Key',
        editable: true,
        preProcessEditCellProps: (params: GridPreProcessEditCellProps<string>) => ({
          ...params.props,
          error:
            !params.props.value?.trim() ||
            !KEY_REGEXP.exec(params.props.value.trim()) ||
            rows.some(r => r.key === params.props.value),
        }),
      },
      {
        field: 'color',
        headerName: 'Color',
        editable: true,
        sortable: false,
        renderCell: params => (
          <Box tabIndex={params.tabIndex} display="flex" height="100%" alignItems="center">
            <ColorValue color={params.value as string} />
          </Box>
        ),
        renderEditCell: params => <EditColor {...params} />,
      },

      { field: 'label', headerName: 'Label', flex: 1, editable: true },
      {
        field: 'activityMapper',
        headerName: 'Activity Mapper',
        flex: 1,
        editable: true,
        sortable: false,
        renderCell: (params: GridRenderCellParams<InitiativeRow, string>) => (
          <Box
            tabIndex={params.tabIndex}
            title={params.value}
            fontFamily="Roboto Mono, monospace"
            fontSize="11px"
            sx={ellipsisSx}
          >
            {params.value || '⋯'}
          </Box>
        ),
        renderEditCell: params => <EditTextarea {...params} />,
        preProcessEditCellProps: (params: GridPreProcessEditCellProps<string>) => {
          try {
            if (params.props.value) {
              compileExpression(params.props.value);
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
        getActions: (params: GridRowParams<InitiativeRow>) => [
          <GridActionsCellItem
            key={1}
            icon={<DeleteIcon />}
            label="Delete"
            onClick={async () => {
              try {
                await confirm({
                  title: 'Confirm Deletion',
                  description: `Delete the initiative "${params.row.label || params.row.key}"?`,
                });
                handleDeleteClick(params.row.id);
              } catch {
                /* user cancelled */
              }
            }}
          />,
        ],
      },
    ],
    [confirm, handleDeleteClick, rows]
  );

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
        onClose={(_, reason) => (reason === 'clickaway' ? null : setConfirmation(''))}
        message={confirmation}
      />
      <BoxPopover popover={colorPickerPopover} onClose={() => setShowColorPickerPopover(null)} />
      <Dialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>New Initiative</DialogTitle>
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
                error={newKeyError}
              />
              <Box title="Color Picker" onClick={e => setColorPickerAnchor(e.currentTarget)}>
                <ColorValue color={newColor} />
              </Box>
              <Popover
                open={!!colorPickerAnchor}
                anchorEl={colorPickerAnchor}
                onClose={() => setColorPickerAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <ColorPicker
                  color={newColor}
                  onChange={color => {
                    setNewColor(color.hex);
                    setColorPickerAnchor(null);
                  }}
                />
              </Popover>
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
                submit(
                  {
                    key: newKey,
                    label: newLabel,
                    color: newColor ?? null,
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
            setNewColor(DEFAULT_COLOR);
            setNewActivityMapperError(false);
            setShowNewDialog(true);
          }}
          startIcon={<AddIcon />}
          sx={{ width: 'fit-content' }}
        >
          New Initiative
        </Button>
        <StyledMuiError>
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
              if (!newRow.key) return newRow;
              if (rows.find(r => r.id !== newRow.id && r.key === newRow.key))
                return { ...newRow, key: '' };
              const updatedRow = { ...newRow, isNew: false };
              if (areRowsEqual(newRow, oldRow)) return updatedRow;
              submit(
                {
                  initiativeId: updatedRow.id,
                  key: updatedRow.key,
                  label: updatedRow.label ?? '',
                  color: updatedRow.color ?? null,
                  activityMapper: updatedRow.activityMapper ?? '',
                },
                postJsonOptions
              );
              return updatedRow;
            }}
            onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save initiative'))}
          />
        </StyledMuiError>
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
