import {
  Add as AddIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
  Close as CloseIcon,
  DeleteOutlined as DeleteIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Unstable_Grid2 as Grid,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  GridActionsCellItem,
  gridStringOrNumberComparator,
  type GridCellParams,
  type GridColDef,
  type GridPreProcessEditCellProps,
  type GridRenderCellParams,
  type GridRowId,
  type GridRowParams,
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
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { isMobile } from 'react-device-detect';
import { useHotkeys } from 'react-hotkeys-hook';
import { getActivityDescription } from '../activityProcessors/activityDescription';
import { findTicket } from '../activityProcessors/activityFeed';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  compileActivityMappers,
  mapActivity,
  MapperType,
} from '../activityProcessors/activityMapper';
import ActivityCard from '../components/ActivityCard';
import App from '../components/App';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import AutocompleteSelect from '../components/datagrid/AutocompleteSelect';
import {
  actionColDef,
  actorColDef,
  dataGridCommonProps,
  dateColDef,
  priorityColDef,
  StyledMuiError,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import EditableCellField from '../components/datagrid/EditableCellField';
import SelectField from '../components/SelectField';
import SmallAvatarChip from '../components/SmallAvatarChip';
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
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import theme, { priorityColors, priorityLabels, prioritySymbols } from '../utils/theme';
import type { ActivityResponse } from './fetcher.activities.($userid)';

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
    getLogger('route:status.user').error(e);
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
    getLogger('route:status.user').info('Saved custom activity ' + ref.id);
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

const priorityOptions: SelectOption[] = [
  { value: '-1', label: '[unset]' },
  ...[1, 2, 3, 4, 5].map(i => ({
    value: `${i}`,
    label: priorityLabels[i],
    color: priorityColors[i],
  })),
];

type ActivityRow = Activity & { hovered?: boolean };

export default function Status() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const confirm = useConfirm();
  const activitiesFetcher = useFetcher();
  const fetchedActivities = activitiesFetcher.data as ActivityResponse;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const isTodaySelected = isToday(selectedDay);
  const [showTeam, setShowTeam] = useState(false);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newActivity, setNewActivity] = useState(emptyActivity);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  const previousDay = () => setSelectedDay(selectedDay.subtract(1, 'day'));
  const nextDay = () => setSelectedDay(selectedDay.add(1, 'day'));

  useHotkeys('n', () => setShowNewDialog(true));
  useHotkeys('[', previousDay);
  useHotkeys(']', nextDay, { enabled: !isTodaySelected });

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
            (loaderData.accountMap[activity.actorId] ?? activity.actorId) // resolve identity
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
      {
        field: 'description',
        headerName: 'Description',
        flex: 1,
        valueGetter: (_, row: ActivityRow) =>
          findTicket(row.metadata) ?? getActivityDescription(row), // sort by ticket or description
        editable: true /* see isCellEditable below for granularity */,
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => (
          <EditableCellField
            layout="text"
            hovered={params.row.hovered && params.row.event === CUSTOM_EVENT}
            label={
              <ActivityCard
                format="Grid"
                activity={params.row}
                ticketBaseUrl={loaderData.customerSettings?.ticketBaseUrl}
                setPopover={(element, content) => setPopover({ element, content })}
              />
            }
          />
        ),
      },
      priorityColDef({
        field: 'priority',
        editable: true /* see isCellEditable below for granularity */,
        type: 'singleSelect',
        valueOptions: priorityOptions,
        valueGetter: (value: number) => `${value}`,
        renderCell: (params: GridRenderCellParams<ActivityRow, string>) => (
          <EditableCellField
            layout="dropdown"
            hovered={params.row.hovered && params.row.event === CUSTOM_EVENT}
            label={
              <Box
                fontSize={params.value && params.value !== '-1' ? 'large' : undefined}
                fontWeight={params.value && params.value !== '-1' ? 600 : undefined}
                color={priorityColors[params.value ? +params.value : -1] ?? undefined}
              >
                {params.value && params.value !== '-1' ?
                  (prioritySymbols[+params.value] ?? '')
                : '⋯'}
              </Box>
            }
          />
        ),
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
            <EditableCellField
              layout="dropdown"
              hovered={params.row.hovered}
              label={
                <Box color={loaderData.launchItems[`${params.value}`]?.color ?? undefined}>
                  {params.value ?
                    (loaderData.launchItems[`${params.value}`]?.key ?? 'unknown')
                  : '⋯'}
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
            <EditableCellField
              layout="dropdown"
              hovered={params.row.hovered}
              label={params.value ? (PHASES.get(`${params.value}`)?.label ?? 'unknown') : '⋯'}
            />
          </Box>
        ),
        renderEditCell: params => <AutocompleteSelect {...params} options={phaseOptions} />,
      },
      {
        field: 'effort',
        headerName: 'Hours',
        headerAlign: 'left',
        type: 'number',
        minWidth: 80,
        editable: true,
        preProcessEditCellProps: (params: GridPreProcessEditCellProps<number>) => ({
          ...params.props,
          error: params.props.value != null && (params.props.value < 0 || params.props.value > 24),
        }),
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => (
          <EditableCellField
            layout="text"
            hovered={params.row.hovered}
            label={params.value ?? '⋯'}
          />
        ),
      },
      {
        field: 'actionDelete',
        type: 'actions',
        cellClassName: 'actions',
        getActions: (params: GridRowParams<ActivityRow>) =>
          params.row.hovered && params.row.event === CUSTOM_EVENT ?
            [
              <GridActionsCellItem
                key={1}
                icon={<DeleteIcon />}
                label="Delete"
                onClick={async () => {
                  try {
                    await confirm({
                      title: 'Confirm Deletion',
                      description: `Delete the activity "${params.row.description}"?`,
                    });
                    handleDeleteClick(params.id);
                  } catch {
                    /* user cancelled */
                  }
                }}
              />,
            ]
          : [],
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

  const isActivitySubmittable = useCallback(
    () =>
      newActivity.action &&
      newActivity.artifact &&
      newActivity.description.trim() &&
      (newActivity.effort ?? 0) <= 24 &&
      (newActivity.effort ?? 0) >= 0,
    [newActivity.action, newActivity.artifact, newActivity.description, newActivity.effort]
  );

  const handleSubmitNewActivity = useCallback(() => {
    if (!isActivitySubmittable) return;
    setShowNewDialog(false);
    submit(
      {
        newActivity: {
          ...newActivity,
          eventTimestamp: isToday(selectedDay) ? Date.now() : selectedDay.endOf('day').valueOf(),
        },
      },
      postJsonOptions
    );
  }, [isActivitySubmittable, newActivity, selectedDay, submit]);

  let datePickerFormat = 'MMM Do';
  if (isTodaySelected) {
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
        options={{
          linkifyObjectId: true,
          linkifyActivityId: loaderData.email?.endsWith('@roakit.com'),
        }}
      />
      <Dialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        fullWidth
        disableRestoreFocus
        PaperProps={{
          component: 'form',
          onSubmit: (e: FormEvent) => {
            e.preventDefault();
            handleSubmitNewActivity();
          },
        }}
      >
        <DialogTitle>New Activity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} my={1}>
            <Stack direction="row" spacing={3}>
              <SelectField
                required
                autoFocus
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
                    label="Hours"
                    type="number"
                    helperText="0 to 24"
                    size="small"
                    sx={{ maxWidth: 90 }}
                    onChange={e => setNewActivity({ ...newActivity, effort: +e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>
            <TextField
              variant="standard"
              required
              autoComplete="off"
              label="Description"
              fullWidth
              onChange={e => setNewActivity({ ...newActivity, description: e.target.value })}
            />
          </Stack>
          <IconButton
            onClick={() => setShowNewDialog(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: theme => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
          <DialogActions>
            <Button
              variant="contained"
              sx={{ borderRadius: 28, textTransform: 'none' }}
              type="submit"
              disabled={!isActivitySubmittable()}
            >
              Post
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
                <SmallAvatarChip name={loaderData.userDisplayName} />
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
                  <SmallAvatarChip name={loaderData.actors[reportId]?.name} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Grid>
        <Grid flex={1} minWidth={300}>
          <Stack spacing={2} sx={{ ml: 2 }}>
            <Stack direction="row">
              <IconButton onClick={previousDay} title="Previous day">
                <ArrowLeftIcon />
              </IconButton>
              <IconButton disabled={isTodaySelected} onClick={nextDay} title="Next day">
                <ArrowRightIcon />
              </IconButton>
              <Box flex={1} />
              <Button
                onClick={() => {
                  setNewActivity(emptyActivity);
                  setShowNewDialog(true);
                }}
                startIcon={<AddIcon />}
                variant="contained"
                sx={{ borderRadius: 28, textTransform: 'none' }}
              >
                Post Custom Activity
              </Button>
            </Stack>
            <StyledMuiError>
              <DataGridWithSingleClickEditing
                columns={columns}
                rows={activities}
                loading={activitiesFetcher.state !== 'idle'}
                {...dataGridCommonProps}
                rowHeight={50}
                slotProps={{
                  row: {
                    onMouseEnter: e => {
                      const activity = activities.find(
                        a => a.id === e.currentTarget.getAttribute('data-id')
                      );
                      if (activity) {
                        activity.hovered = true;
                        setActivities([...activities]);
                      }
                    },
                    onMouseLeave: e => {
                      const activity = activities.find(a => a.hovered);
                      if (activity) {
                        activity.hovered = false;
                        setActivities([...activities]);
                      }
                    },
                  },
                }}
                isCellEditable={(params: GridCellParams<Activity>) => {
                  if (
                    params.field === 'launchItemId' ||
                    params.field === 'phase' ||
                    params.field === 'effort'
                  ) {
                    return true;
                  }
                  const eventType = params.row.eventType;
                  return (
                    (params.field === 'description' || params.field === 'priority') &&
                    eventType === CUSTOM_EVENT
                  );
                }}
                processRowUpdate={(updatedRow: Activity, oldRow: Activity) => {
                  if (
                    updatedRow.description !== oldRow.description ||
                    updatedRow.priority != oldRow.priority ||
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
            {!isMobile && (
              <Typography
                variant="caption"
                fontStyle="italic"
                color={theme.palette.grey[500]}
                display="flex"
                justifyContent="center"
                sx={{
                  code: {
                    backgroundColor: theme.palette.grey[200],
                    border: '1px solid',
                    borderColor: theme.palette.grey[400],
                    borderRadius: '5px',
                    p: '1px 4px',
                    mt: '-2px',
                    mx: '1px',
                  },
                }}
              >
                <span>
                  {activities.length > 0 ? 'Some cells editable by clicking on them. ' : ''}
                  Press <code>N</code> to create a custom activity, <code>[</code> and{' '}
                  <code>]</code> to go to previous/next day.
                </span>
              </Typography>
            )}
          </Stack>
        </Grid>
      </Grid>
    </App>
  );
}
