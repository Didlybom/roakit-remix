import {
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
  MenuBook as DocumentationIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  Popper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  GridActionsCellItem,
  GridColDef,
  GridRowEditStopReasons,
  GridRowId,
  GridSortDirection,
  useGridApiContext,
  type GridEventListener,
  type GridRenderEditCellParams,
} from '@mui/x-data-grid';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { compileExpression } from 'filtrex';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { GithubPicker as ColorPicker, type ColorResult } from 'react-color';
import App from '../components/App';
import type { BoxPopoverContent } from '../components/BoxPopover';
import BoxPopover from '../components/BoxPopover';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import EditTextarea from '../components/datagrid/EditTextarea';
import { dataGridCommonProps, StyledMuiError } from '../components/datagrid/dataGridCommon';
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
  color?: string | null;
  isNew?: boolean;
  activityMapper?: string;
}

const areRowsEqual = (a: LaunchItemRow, b: LaunchItemRow) =>
  a.key === b.key &&
  a.label === b.label &&
  a.color === b.color &&
  a.activityMapper === b.activityMapper;

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

interface ActionRequest {
  launchItemId: string;
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
  const sessionData = await loadSession(request, VIEW);
  const actionRequest = (await request.json()) as ActionRequest;
  const launchItemId = actionRequest.launchItemId;

  if (request.method === 'DELETE') {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/launchItems/${launchItemId}`)
        .delete();
      return { status: { code: 'deleted', message: 'Launch item deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete launch item') };
    }
  }

  try {
    if (launchItemId) {
      await firestore
        .doc(`customers/${sessionData.customerId!}/launchItems/${launchItemId}`)
        .set(actionRequest, { merge: true });
    } else {
      await firestore
        .collection(`customers/${sessionData.customerId!}/launchItems`)
        .add(actionRequest);
    }
    return { status: { code: 'saved', message: 'Launch item saved' } };
  } catch (e) {
    return { error: errMsg(e, 'Failed to save launch item') };
  }
};

function ColorValue({ color }: { color?: string }) {
  return (
    <Box
      width={40}
      height={20}
      border="solid 1px"
      sx={{ cursor: ' pointer', backgroundColor: color, opacity: color ? 1 : 0.3 }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditColor(props: GridRenderEditCellParams<any, string>) {
  const { id, field, value } = props;
  const [valueState, setValueState] = useState(value);
  const [showPicker, setShowPicker] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>();
  const apiRef = useGridApiContext();

  const handleRef = useCallback((el: HTMLElement | null) => setAnchorEl(el), []);

  const handleChange = useCallback(
    async (color: ColorResult, event: ChangeEvent<HTMLInputElement>) => {
      setValueState(color.hex);
      setShowPicker(false);
      await apiRef.current.setEditCellValue({ id, field, value: color.hex }, event);
      apiRef.current.stopCellEditMode({ id, field });
    },
    [apiRef, field, id]
  );

  return (
    <Box display="flex" height="100%" alignItems="center" ml={1} ref={handleRef}>
      {anchorEl && (
        <Popper open={showPicker} anchorEl={anchorEl} placement="bottom-start">
          <ClickAwayListener onClickAway={() => setShowPicker(false)}>
            <ColorPicker width="212" color={valueState} onChange={handleChange} />
          </ClickAwayListener>
        </Popper>
      )}
      <Box onClick={() => setShowPicker(true)}>
        <ColorValue color={valueState} />
      </Box>
    </Box>
  );
}

export default function LaunchItems() {
  const DEFAULT_COLOR = '#d4c4fb';
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const confirm = useConfirm();
  const [rows, setRows] = useState<LaunchItemRow[]>([]);
  const [colorPickerPopover, setShowColorPickerPopover] = useState<BoxPopoverContent | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLOR);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLDivElement | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newActivityMapper, setNewActivityMapper] = useState('');
  const [newActivityMapperError, setNewActivityMapperError] = useState(false);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(
      loaderData.launchItems.map(launchItem => ({
        ...launchItem,
        key: launchItem.key ?? launchItem.id,
      }))
    );
  }, [loaderData.launchItems]);

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
        return {
          ...params.props,
          error: !(params.props.value as string)?.trim(),
        };
      },
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

    { field: 'label', headerName: 'Label', editable: true },
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
        const launchItem = params.row as LaunchItemRow;
        return [
          <GridActionsCellItem
            key={1}
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
              <Box title="Color Picker" onClick={e => setColorPickerAnchor(e.currentTarget)}>
                <ColorValue color={newColor} />
              </Box>
              <Popover
                open={!!colorPickerAnchor}
                anchorEl={colorPickerAnchor}
                onClose={() => setColorPickerAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <ColorPicker
                  color={newColor}
                  triangle="hide"
                  width="212"
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
          New Launch Item
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
            processRowUpdate={(newRow: LaunchItemRow, oldRow: LaunchItemRow) => {
              if (!newRow.key) {
                return newRow;
              }
              if (rows.find(r => r.key === newRow.key && r.id !== newRow.id)) {
                return { ...newRow, key: '' };
              }
              const updatedRow = { ...newRow, isNew: false };
              if (areRowsEqual(newRow, oldRow)) {
                return updatedRow;
              }
              submit(
                {
                  launchItemId: updatedRow.id,
                  key: updatedRow.key,
                  label: updatedRow.label ?? '',
                  color: updatedRow.color ?? null,
                  activityMapper: updatedRow.activityMapper ?? '',
                },
                postJsonOptions
              );
              return updatedRow;
            }}
            onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save launch item'))}
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
