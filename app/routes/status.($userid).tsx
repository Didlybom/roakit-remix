import { Add as AddIcon, DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Unstable_Grid2 as Grid,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  GridActionsCellItem,
  gridStringOrNumberComparator,
  type GridColDef,
  type GridRowId,
} from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useConfirm } from 'material-ui-confirm';
import pino from 'pino';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  compileActivityMappers,
  mapActivity,
  MapperType,
} from '../activityProcessors/activityMapper';
import App from '../components/App';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import AutocompleteSelect from '../components/datagrid/AutocompleteSelect';
import {
  actionColDef,
  actorColDef,
  dataGridCommonProps,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  StyledMuiError,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import DropDownButton from '../components/datagrid/DropDownButton';
import SelectField from '../components/SelectField';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import { CUSTOM_EVENT, PHASES, type Account, type Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { formatYYYYMMDD, isToday, isValidDate, isYesterday } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import {
  errorAlert,
  loaderErrorResponse,
  loginWithRedirectUrl,
  type SelectOption,
} from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import { priorityColors, priorityLabels } from '../utils/theme';
import type { ActivityResponse } from './fetcher.activities.($userid)';

const logger = pino({ name: 'route:status.user' });

export const meta = () => [{ title: 'Status Form | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Status;
const SEARCH_PARAM_DAY = 'day';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW, params);

  try {
    const [initiatives, launchItems, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!), // could be optimized if we fetch identity first, we don't need it for individual contributors
      fetchIdentities(sessionData.customerId!),
    ]);

    const userId = params.userid; // impersonification, see utils/rbac.ts

    const userIdentity = identities.list.find(identity => {
      if (userId) {
        return identity.id === userId;
      } else {
        return identity.email === sessionData.email;
      }
    });
    if (!userIdentity) {
      throw new Response('Identity not found', { status: 500 });
    }

    return {
      ...sessionData,
      userId,
      userDisplayName: userIdentity.displayName,
      reportIds: userIdentity.reportIds,
      initiatives,
      launchItems,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      accountMap: identities.accountMap,
    };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

type NewActivity = {
  action: string;
  artifact: string;
  launchItemId: string;
  phase: string;
  description: string;
  priority: number | null;
  effort: number | null;
  eventTimestamp: number;
};

const emptyActivity: NewActivity = {
  action: '',
  artifact: '',
  launchItemId: '',
  phase: '',
  description: '',
  priority: null,
  effort: null,
  eventTimestamp: 0,
};

interface ActionRequest {
  day?: string;
  activityId: string;
  launchItemId: string;
  phase: string;
  description: string;
  priority: number;
  effort: number;
  newActivity?: NewActivity;
}

interface ActionResponse {
  status?: { code: 'created' | 'updated' | 'deleted'; message?: string };
  error?: string;
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;

  let identityId = params.userid; // impersonification
  if (!identityId) {
    const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
    identityId = identity.id;
  }
  if (!identityId) {
    throw 'Identity required';
  }

  // delete custom activity
  if (request.method === 'DELETE') {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
        .delete();
      return { status: { code: 'deleted', message: 'Activity deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete activity') };
    }
  }
  // update activity
  if (actionRequest.activityId) {
    await firestore
      .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
      .update({
        launchItemId: actionRequest.launchItemId,
        phase: actionRequest.phase,
        description: actionRequest.description,
        priority: actionRequest.priority,
        effort: actionRequest.effort,
      });
    return { status: { code: 'updated', message: 'Activity updated' } };
  }

  // save new activity
  if (actionRequest.newActivity) {
    const ref = await firestore.collection(`customers/${sessionData.customerId!}/activities`).add({
      ...actionRequest.newActivity,
      priority: actionRequest.newActivity.priority ?? -1,
      eventType: CUSTOM_EVENT,
      event: CUSTOM_EVENT,
      actorAccountId: identityId,
      createdTimestamp: actionRequest.newActivity.eventTimestamp, // for now we filter fetch activities by created date, not event date (see fetchers.server.ts#fetchActivities)
      initiative: '',
    });
    logger.info('Saved custom activity ' + ref.id);
    return { status: { code: 'created', message: 'Activity created' } };
  }

  return { status: undefined };
};
const artifactOptions: SelectOption[] = [
  { value: 'task', label: 'Task' },
  { value: 'taskOrg', label: 'Task Organization' },
  { value: 'code', label: 'Code' },
  { value: 'codeOrg', label: 'Code Organization' },
  { value: 'doc', label: 'Documentation' },
  { value: 'docOrg', label: 'Documentation Organization' },
];

const phaseOptions: SelectOption[] = [
  { value: '', label: '[unset]' },
  ...[...PHASES.entries()].map(([phaseId, phase]) => ({ value: phaseId, label: phase.label })),
];

const priorityOptions: SelectOption[] = [1, 2, 3, 4, 5].map(i => ({
  value: `${i}`,
  label: priorityLabels[i],
  color: priorityColors[i],
}));

export default function Status() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const confirm = useConfirm();
  const activitiesFetcher = useFetcher();
  const fetchedActivities = activitiesFetcher.data as ActivityResponse;
  const [activities, setActivities] = useState<Activity[]>([]);
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const [showTeam, setShowTeam] = useState(false);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newActivity, setNewActivity] = useState(emptyActivity);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
  }, [loaderData.initiatives, loaderData.launchItems]);

  // load activities for the selected day
  useEffect(() => {
    if (actionData?.status?.code === 'updated' || actionData?.status?.code === 'deleted') {
      return;
    }
    if (!isValidDate(selectedDay)) {
      setError('Invalid date');
      return;
    }
    activitiesFetcher.load(
      `/fetcher/activities/${loaderData.userId ?? ''}?${showTeam ? 'includeTeam=true&' : ''}start=${selectedDay.startOf('day').valueOf()}&end=${selectedDay.endOf('day').valueOf()}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, showTeam, actionData?.status]); // activitiesFetcher and loaderData must be omitted

  // handle fetched activities
  useEffect(() => {
    if (!fetchedActivities?.activities) {
      return;
    }
    const activityRows: Activity[] = [];
    const activities = Object.values(fetchedActivities.activities);
    activities.forEach(activity => {
      let mapping;
      if (!activity.initiativeId || activity.launchItemId == null) {
        mapping = mapActivity(activity);
      }
      activityRows.push({
        ...activity,
        initiativeId: activity.initiativeId || mapping?.initiatives[0] || '',
        actorId:
          activity.actorId ?
            loaderData.accountMap[activity.actorId] ?? activity.actorId // resolve identity
          : undefined,
      });
    });
    setActivities(activityRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities]); // loaderData must be omitted

  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
    }
  }, [actionData?.status]);

  useEffect(() => {
    if (fetchedActivities?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivities?.error, navigate]);

  const launchItemOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '[unset]' },
      ...Object.keys(loaderData.launchItems).map(launchId => {
        const launchItem = loaderData.launchItems[launchId];
        return {
          value: launchId,
          label: `[${launchItem.key}] ${launchItem.label}`,
          color: launchItem.color,
        };
      }),
    ],
    [loaderData.launchItems]
  );

  const handleDeleteClick = useCallback(
    (activityId: GridRowId) => {
      setActivities(activities.filter(row => row.id !== activityId));
      submit({ activityId }, deleteJsonOptions);
    },
    [activities, submit]
  );

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({
        field: 'timestamp',
        minWidth: 100,
        valueGetter: value => (value ? new Date(value) : value),
      }),
      actionColDef({ field: 'action' }),
      ...(showTeam ?
        [
          actorColDef({
            field: 'actorId',
            valueGetter: (value: string) =>
              value ?
                ({ id: value, name: loaderData.actors[value]?.name ?? 'unknown' } as Account)
              : null,
          }),
        ]
      : []),
      descriptionColDef(
        { field: 'description', editable: true /* see isCellEditable below for granularity */ },
        (element, content) => setPopover({ element, content }),
        loaderData.customerSettings?.ticketBaseUrl
      ),
      priorityColDef({
        field: 'priority',
        editable: true,
        renderEditCell: params => <AutocompleteSelect {...params} options={priorityOptions} />,
      }),

      {
        field: 'launchItemId',
        headerName: 'Launch',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: launchItemOptions,
        sortComparator: (a: string, b: string, paramA, paramB) =>
          gridStringOrNumberComparator(
            a ? loaderData.launchItems[a].key : '',
            b ? loaderData.launchItems[b].key : '',
            paramA,
            paramB
          ),
        editable: true,
        renderCell: params => (
          <Box height="100%" display="flex" alignItems="center">
            <DropDownButton
              tabIndex={params.tabIndex}
              label={
                <Box color={loaderData.launchItems[`${params.value}`]?.color ?? undefined}>
                  {params.value ? loaderData.launchItems[`${params.value}`]?.key ?? 'unknown' : '⋯'}
                </Box>
              }
            />
          </Box>
        ),
        renderEditCell: params => <AutocompleteSelect {...params} options={launchItemOptions} />,
      },
      {
        field: 'phase',
        headerName: 'Phase',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: phaseOptions,
        sortComparator: (a: string, b: string) =>
          (PHASES.get(a)?.sortOrder ?? 999) - (PHASES.get(b)?.sortOrder ?? 999),
        editable: true,
        renderCell: params => (
          <Box height="100%" display="flex" alignItems="center">
            <DropDownButton
              tabIndex={params.tabIndex}
              label={params.value ? PHASES.get(`${params.value}`)?.label ?? 'unknown' : null}
            />
          </Box>
        ),
        renderEditCell: params => <AutocompleteSelect {...params} options={phaseOptions} />,
      },
      {
        field: 'effort',
        headerName: 'Effort',
        type: 'number',
        minWidth: 80,
        editable: true,
        preProcessEditCellProps: params => {
          const value = params.props.value as number;
          return { ...params.props, error: value < 0 || value > 24 };
        },
        renderCell: params => (
          <Box tabIndex={params.tabIndex} sx={{ cursor: ' pointer' }}>
            {(params.value as number) ?? '⋯'}
          </Box>
        ),
      },
      {
        field: 'actionDelete',
        type: 'actions',
        cellClassName: 'actions',
        getActions: params => {
          const activity = params.row as Activity;
          return activity.event === CUSTOM_EVENT ?
              [
                <GridActionsCellItem
                  key={1}
                  icon={<DeleteIcon />}
                  label="Delete"
                  onClick={async () => {
                    try {
                      await confirm({
                        description: `Please confirm the deletion of activity "${activity.description}".`,
                      });
                      handleDeleteClick(params.id);
                    } catch {
                      /* user cancelled */
                    }
                  }}
                />,
              ]
            : [];
        },
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ],
    [
      showTeam,
      loaderData.customerSettings?.ticketBaseUrl,
      loaderData.actors,
      loaderData.launchItems,
      launchItemOptions,
      confirm,
      handleDeleteClick,
    ]
  );

  let datePickerFormat = 'MMM Do';
  if (isToday(selectedDay)) {
    datePickerFormat = 'Today';
  } else if (isYesterday(selectedDay)) {
    datePickerFormat = 'Yesterday';
  }

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle' || activitiesFetcher.state !== 'idle'}
    >
      {errorAlert(fetchedActivities?.error?.message)}
      {errorAlert(error)}
      <Snackbar
        open={!!confirmation}
        autoHideDuration={2000}
        onClose={(_, reason) => (reason === 'clickaway' ? null : setConfirmation(''))}
        message={confirmation}
      />
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyActivityId: true }}
      />
      <Dialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>New Activity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} my={1}>
            <Stack direction="row" spacing={3}>
              <SelectField
                required
                value={newActivity.action}
                onChange={newValue => setNewActivity({ ...newActivity, action: newValue })}
                label="Action"
                items={[
                  { value: 'created', label: 'Created' },
                  { value: 'updated', label: 'Updated' },
                  { value: 'deleted', label: 'Deleted' },
                ]}
              />
              <SelectField
                required
                value={newActivity.artifact}
                onChange={artifact => setNewActivity({ ...newActivity, artifact })}
                label="Artifact"
                items={artifactOptions}
              />
            </Stack>
            <Box sx={{ ml: '-30px' }}>
              <Grid container spacing={3}>
                <Grid>
                  <SelectField
                    value={newActivity.launchItemId}
                    onChange={launchItemId => setNewActivity({ ...newActivity, launchItemId })}
                    label="Launch"
                    items={launchItemOptions}
                  />
                </Grid>
                <Grid>
                  <SelectField
                    value={newActivity.phase}
                    onChange={phase => setNewActivity({ ...newActivity, phase })}
                    label="Phase"
                    items={phaseOptions}
                  />
                </Grid>
                <Grid>
                  <SelectField
                    value={newActivity.priority ? `${newActivity.priority}` : ''}
                    onChange={priority =>
                      setNewActivity({ ...newActivity, priority: +priority ?? null })
                    }
                    label="Priority"
                    items={priorityOptions}
                  />
                </Grid>
                <Grid>
                  <TextField
                    autoComplete="off"
                    label="Effort"
                    type="number"
                    helperText="0 - 24"
                    size="small"
                    sx={{ maxWidth: 90 }}
                    onChange={e => setNewActivity({ ...newActivity, effort: +e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>
            <TextField
              required
              autoComplete="off"
              label="Description"
              size="small"
              fullWidth
              onChange={e => setNewActivity({ ...newActivity, description: e.target.value })}
            />
          </Stack>
          <DialogActions>
            <Button onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                !newActivity.action ||
                !newActivity.artifact ||
                !newActivity.description.trim() ||
                (newActivity.effort ?? 0) > 24 ||
                (newActivity.effort ?? 0) < 0
              }
              onClick={() => {
                setShowNewDialog(false);
                submit(
                  {
                    newActivity: {
                      ...newActivity,
                      eventTimestamp: selectedDay.endOf('day').valueOf(),
                    },
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
      <BoxPopover popover={popover} onClose={() => setPopover(null)} showClose={true} />
      <Grid container sx={{ m: 3, ml: 0 }}>
        <Grid>
          <Stack sx={{ mb: 4 }}>
            <Box sx={{ ml: 3, mr: 1, mb: 3 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  disableFuture={true}
                  slotProps={{ textField: { size: 'small', sx: { width: '160px' } } }}
                  value={selectedDay}
                  format={datePickerFormat}
                  onChange={day => {
                    if (day) {
                      setSelectedDay(day);
                      setSearchParams(prev => {
                        prev.set(SEARCH_PARAM_DAY, formatYYYYMMDD(day));
                        return prev;
                      });
                    }
                  }}
                />
              </LocalizationProvider>
            </Box>
            <Stack spacing={1} sx={{ ml: 3 }}>
              <Typography fontSize="small" fontWeight={500}>
                Activities for…
              </Typography>
              <Box sx={{ opacity: showTeam ? 0.3 : undefined }}>
                <Chip size="small" label={loaderData.userDisplayName} />
              </Box>
              {!!loaderData.reportIds?.length && (
                <FormControlLabel
                  control={
                    <Switch checked={showTeam} onChange={e => setShowTeam(e.target.checked)} />
                  }
                  label={
                    <Typography fontSize="small" fontWeight={500}>
                      Team
                    </Typography>
                  }
                />
              )}
              {loaderData.reportIds?.map(reportId => (
                <Box key={reportId} sx={{ opacity: showTeam ? undefined : 0.3 }}>
                  <Chip size="small" label={loaderData.actors[reportId]?.name ?? 'Unknown'} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Grid>
        <Grid flex={1} minWidth={300}>
          <Stack spacing={2} sx={{ ml: 2 }}>
            <Button
              onClick={() => {
                setNewActivity(emptyActivity);
                setShowNewDialog(true);
              }}
              startIcon={<AddIcon />}
              sx={{ width: 'fit-content' }}
            >
              New Activity
            </Button>
            <StyledMuiError>
              <DataGridWithSingleClickEditing
                columns={columns}
                rows={activities}
                loading={activitiesFetcher.state !== 'idle'}
                {...dataGridCommonProps}
                rowHeight={50}
                isCellEditable={params => {
                  if (
                    params.field === 'launchItemId' ||
                    params.field === 'phase' ||
                    params.field === 'effort'
                  ) {
                    return true;
                  }
                  const eventType = (params.row as Activity).eventType;
                  return (
                    (params.field === 'description' || params.field === 'priority') &&
                    eventType === CUSTOM_EVENT
                  );
                }}
                processRowUpdate={(updatedRow: Activity, oldRow: Activity) => {
                  if (
                    updatedRow.description !== oldRow.description ||
                    updatedRow.priority !== oldRow.priority ||
                    updatedRow.launchItemId !== oldRow.launchItemId ||
                    updatedRow.phase !== oldRow.phase ||
                    updatedRow.effort !== oldRow.effort
                  ) {
                    submit(
                      {
                        day: formatYYYYMMDD(selectedDay),
                        activityId: updatedRow.id,
                        description: updatedRow.description ?? null,
                        priority: updatedRow.priority ? +updatedRow.priority : -1,
                        launchItemId: updatedRow.launchItemId ?? null,
                        phase: updatedRow.phase ?? null,
                        effort: updatedRow.effort ?? null,
                      },
                      postJsonOptions
                    );
                  }
                  return updatedRow;
                }}
              />
            </StyledMuiError>
          </Stack>
        </Grid>
      </Grid>
    </App>
  );
}
