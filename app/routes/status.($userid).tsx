import {
  AddCircle as AddIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DeleteOutlined as DeleteIcon,
  Redo as OngoingIcon,
  WorkHistory as TicketIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  GridActionsCellItem,
  gridStringOrNumberComparator,
  useGridApiRef,
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
import ActivityCard from '../components/ActivityCard';
import App from '../components/App';
import { SmallAvatarChip } from '../components/Avatars';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
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
import AutocompleteSelect from '../components/datagrid/EditAutocompleteSelect';
import SelectField from '../components/forms/SelectField';
import FilterMenu from '../components/forms/SelectFilter';
import HelperText from '../components/HelperText';
import SmallButton from '../components/SmallButton';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchGroups,
  fetchIdentities,
  fetchInitiativeMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import {
  insertActivity,
  upsertInitiativeIndividualCounters,
  upsertNextOngoingActivity,
  upsertTicket,
} from '../firestore.server/updaters.server';
import { getActivityDescription } from '../processors/activityDescription';
import { findFirstTicket, inferTicketStatus } from '../processors/activityFeed';
import {
  groupActorActivities,
  type GroupedActorActivities,
  type InitiativeWithTicketStats,
} from '../processors/activityGrouper';
import { identifyAccounts } from '../processors/activityIdentifier';
import { compileActivityMappers, mapActivity } from '../processors/activityMapper';
import {
  CUSTOM_EVENT,
  PHASES,
  type Account,
  type Activity,
  type ActivityMetadata,
  type Artifact,
  type Identity,
  type Phase,
  type Ticket,
} from '../types/types';
import { loadAndValidateSession } from '../utils/authUtils.server';
import {
  formatYYYYMMDD,
  isToday,
  isValidDate,
  isYesterday,
  nextBusinessDay,
  prevBusinessDay,
} from '../utils/dateUtils';
import { errMsg, RoakitError } from '../utils/errorUtils';
import { deleteJsonOptions, postJsonOptions } from '../utils/httpUtils';
import {
  errorAlert,
  formatJson,
  getSearchParam,
  linkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
  type SelectOption,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import theme, { priorityColors, priorityLabels, prioritySymbols } from '../utils/theme';
import type { ActivityResponse } from './fetcher.activities.($userid)';
import type { TicketsResponse } from './fetcher.tickets';

export const meta = () => [{ title: 'Status Form | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Status;
const SEARCH_PARAM_DAY = 'day';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);

  try {
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
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
      throw new RoakitError('Identity not found', { httpStatus: 500 });
    }

    let groups;
    if (userIdentity.reportIds?.length && userIdentity.groups?.length) {
      groups = (await fetchGroups(sessionData.customerId!)).filter(g =>
        userIdentity.groups!.includes(g.id)
      );
    }

    return {
      ...sessionData,
      userId,
      identityId: userIdentity.id,
      userDisplayName: userIdentity.displayName,
      reportIds: userIdentity.reportIds,
      groups,
      initiatives,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      accountMap: identities.accountMap,
      identities: identities.list.filter(
        i => i.id === userIdentity.id || userIdentity.reportIds?.includes(i.id)
      ),
      isLocal: request.headers.get('host') === 'localhost:3000',
    };
  } catch (e) {
    getLogger('route:status.user').error(e);
    throw loaderErrorResponse(e);
  }
};

type NewActivity = {
  action: string;
  artifact: Artifact;
  initiativeId: string;
  phase: Phase | null;
  description: string;
  priority: number | null;
  effort: number | null;
  timestamp: number;
};

const emptyActivity: NewActivity = {
  action: '',
  artifact: '' as Artifact,
  initiativeId: '',
  phase: null,
  description: '',
  priority: null,
  effort: null,
  timestamp: 0,
};

interface ActionRequest {
  day: string;

  // update
  activityId: string;
  initiativeId: string;
  phase: string;
  description: string;
  priority: number;
  effort: number;
  ongoing: boolean;
  actorId: string;
  ticket?: Ticket;
  metadata?: ActivityMetadata;

  // field only used for next ongoing
  eventType: string;
  action: string;
  artifact: Artifact;
  createdTimestamp: number;
  timestamp: number;

  // creation
  newActivity?: NewActivity;

  // initiative stats
  initiativeStats?: Record<Identity['id'], InitiativeWithTicketStats[]>;
}

interface ActionResponse {
  status?: { code: 'created' | 'updated' | 'deleted'; message?: string };
  error?: string;
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;

  let identityId = params.userid; // impersonification
  if (!identityId) {
    const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
    identityId = identity.id;
  }
  if (!identityId) {
    throw Error('Identity required');
  }

  let response: ActionResponse = { status: undefined };
  // delete custom activity
  if (request.method === 'DELETE') {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
        .delete();
      response = { status: { code: 'deleted', message: 'Activity deleted' } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to delete activity') };
    }
  } else {
    // update activity
    if (actionRequest.activityId) {
      const activity = {
        initiativeId: actionRequest.initiativeId,
        phase: actionRequest.phase as Phase,
        description: actionRequest.description,
        priority: actionRequest.priority,
        effort: actionRequest.effort,
        ongoing: actionRequest.ongoing,
      };
      await firestore
        .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
        .update(activity);
      if (actionRequest.ongoing) {
        if (actionRequest.actorId !== identityId) {
          // not creating an ongoing activity for self
          // enforce it's for a report
          const activityIdentity = await queryIdentity(sessionData.customerId!, {
            identityId: actionRequest.actorId,
          });
          if (activityIdentity.managerId !== identityId) {
            throw Error('Invalid contributor');
          }
        }
        const ongoingAdded = await upsertNextOngoingActivity(sessionData.customerId!, {
          id: actionRequest.activityId,
          ...activity,
          actorId: actionRequest.actorId,
          action: actionRequest.action,
          artifact: actionRequest.artifact as Artifact,
          createdTimestamp: actionRequest.createdTimestamp,
          timestamp: actionRequest.createdTimestamp,
          initiativeId: actionRequest.initiativeId,
          eventType: actionRequest.eventType,
          metadata: actionRequest.metadata,
        });
        if (ongoingAdded) {
          getLogger('route:status.user').info('Saved ongoing activity ' + ongoingAdded.id);
        }
      }
      response = { status: { code: 'updated', message: 'Activity updated' } };
    }

    // save new activity
    if (actionRequest.newActivity) {
      const newActivityId = await insertActivity(sessionData.customerId!, {
        ...actionRequest.newActivity,
        priority: actionRequest.newActivity.priority ?? -1,
        eventType: CUSTOM_EVENT,
        event: CUSTOM_EVENT,
        actorAccountId: identityId,
        identityId,
        createdTimestamp: actionRequest.newActivity.timestamp, // for now we filter fetch activities by created date, not event date (see fetchers.server.ts#fetchActivities)
        initiative: '',
      });
      getLogger('route:status.user').info('Saved custom activity ' + newActivityId);
      response = { status: { code: 'created', message: 'Activity created' } };
    }
  }

  // update tickets
  if (actionRequest.ticket) {
    await upsertTicket(sessionData.customerId!, actionRequest.ticket);
    getLogger('route:status.user').info('Updated ticket ' + actionRequest.ticket.key);
  }

  // update initiative stats
  if (actionRequest.initiativeStats) {
    await Promise.all(
      Object.entries(actionRequest.initiativeStats).map(
        async ([statIdentityId, initiativeStats]) => {
          // ensure users are legit owner or reports
          if (identityId !== statIdentityId) {
            if (
              (await queryIdentity(sessionData.customerId!, { identityId })).managerId !==
              identityId
            ) {
              throw Error('Invalid contributor');
            }
          }
          await upsertInitiativeIndividualCounters(
            sessionData.customerId!,
            statIdentityId,
            actionRequest.day,
            initiativeStats,
            '*'
          );
        }
      )
    );
  }

  return response;
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
  { value: '', label: 'None', color: theme.palette.grey[500] },
  ...[...PHASES.entries()].map(([phaseId, phase]) => ({ value: phaseId, label: phase.label })),
];

const priorityOptions: SelectOption[] = [
  { value: '', label: 'None', color: theme.palette.grey[500] },
  ...[1, 2, 3, 4, 5].map(i => ({
    value: `${i}`,
    label: priorityLabels[i],
    color: priorityColors[i],
  })),
];

type ActivityRow = Activity & { ticketKey?: string; hovered?: boolean };

export default function Status() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const confirm = useConfirm();
  const activitiesFetcher = useFetcher();
  const fetchedActivities = activitiesFetcher.data as ActivityResponse;
  const ticketsFetcher = useFetcher();
  const fetchedTickets = ticketsFetcher.data as TicketsResponse;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<Record<
    Identity['id'],
    GroupedActorActivities
  > | null>(null);
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    dayjs(searchParams.get(SEARCH_PARAM_DAY) ?? prevBusinessDay(new Date()))
  );
  const isTodaySelected = isToday(selectedDay);
  const [showTeam, setShowTeam] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const gridApiRef = useGridApiRef();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newActivity, setNewActivity] = useState(emptyActivity);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  const previousDay = () => {
    const prevDay = dayjs(prevBusinessDay(selectedDay.valueOf()));
    setSelectedDay(prevDay);
    setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_DAY, formatYYYYMMDD(prevDay)));
  };
  const nextDay = () => {
    const nextDay = dayjs(nextBusinessDay(selectedDay.valueOf()));
    setSelectedDay(nextDay);
    setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_DAY, formatYYYYMMDD(nextDay)));
  };

  useHotkeys('n', () => setShowNewDialog(true));
  useHotkeys('[', previousDay);
  useHotkeys(']', nextDay);

  const updateStats = useCallback((activities: Activity[]) => {
    const groupedActivities: Record<Identity['id'], GroupedActorActivities> = {};
    const initiativeStats: Record<Identity['id'], InitiativeWithTicketStats[]> = {};
    [...new Set(activities.map(a => a.actorId))].forEach(identityId => {
      groupedActivities[identityId!] = groupActorActivities(
        activities.filter(a => a.actorId === identityId)
      );
      if (identityId && groupedActivities[identityId].initiatives) {
        initiativeStats[identityId] = groupedActivities[identityId].initiatives;
      }
    });
    setGroupedActivities(groupedActivities);
    return initiativeStats;
  }, []);

  useEffect(() => {
    compileActivityMappers(loaderData.initiatives);
  }, [loaderData.initiatives]);

  // (re)load activities for the selected day
  useEffect(() => {
    if (actionData?.status?.code === 'deleted' || actionData?.status?.code === 'updated') {
      return;
    }
    if (!isValidDate(selectedDay)) {
      setError('Invalid date');
      return;
    }
    activitiesFetcher.load(
      `/fetcher/activities/${loaderData.identityId ?? ''}?useIdentityId=true&${showTeam ? 'includeTeam=true&' : ''}${groupFilter ? `group=${groupFilter}&` : ''}start=${selectedDay.startOf('day').valueOf()}&end=${selectedDay.endOf('day').valueOf()}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, showTeam, groupFilter, actionData?.status]); // activitiesFetcher and loaderData must be omitted

  // handle fetched activities
  // note that posting/editing/deleting relies on this to run after action.status comes back changed (see activitiesFetcher effect above)
  useEffect(() => {
    if (!fetchedActivities?.activities) {
      return;
    }
    const activityRows: ActivityRow[] = [];
    const ticketKeys: string[] = [];
    const activities = Object.values(fetchedActivities.activities);
    activities.forEach(activity => {
      const activityStats = groupActorActivities([activity]);
      const ticketKey = activityStats.tickets[0]?.key;
      activityRows.push({
        ...activity,
        initiativeId:
          activity.initiativeId != null ? activity.initiativeId : (mapActivity(activity)[0] ?? ''),
        actorId:
          activity.actorId ?
            (loaderData.accountMap[activity.actorId] ?? activity.actorId) // resolve identity
          : undefined,
        ticketKey,
      });
      if (!ticketKeys.includes(ticketKey)) ticketKeys.push(ticketKey);
    });
    if (ticketKeys.length) {
      ticketsFetcher.load(`/fetcher/tickets?keys=${ticketKeys.join(',')}`);
    }

    setActivities(activityRows);
    const initiativeStats = updateStats(activityRows);
    submit(
      {
        day: formatYYYYMMDD(selectedDay),
        initiativeStats: initiativeStats ?? null,
      },
      postJsonOptions
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities, loaderData.accountMap, selectedDay, submit, updateStats]); // ticketsFetcher must be omitted

  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
    }
  }, [actionData?.status]);

  useEffect(() => {
    setError(actionData?.error ?? '');
  }, [actionData?.error]);

  useEffect(() => {
    if (fetchedActivities?.error?.status === 401 || fetchedTickets?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivities?.error, fetchedTickets?.error, navigate]);

  const initiativeOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'None', color: theme.palette.grey[500] },
      ...Object.entries(loaderData.initiatives).map(([initiativeId, initiative]) => ({
        value: initiativeId,
        label: `[${initiative.key}] ${initiative.label}`,
        color: initiative.color,
      })),
    ],
    [loaderData.initiatives]
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
    const timestamp = isToday(selectedDay) ? Date.now() : selectedDay.endOf('day').valueOf();
    const activity = {
      ...newActivity,
      timestamp,
      createdTimestamp: timestamp,
      id: '',
    };
    const initiativeStats = updateStats([activity, ...activities]);
    setShowNewDialog(false);
    submit(
      { newActivity: activity, day: formatYYYYMMDD(selectedDay), initiativeStats },
      postJsonOptions
    );
  }, [activities, isActivitySubmittable, newActivity, selectedDay, submit, updateStats]);

  const handleDeleteClick = useCallback(
    (activityId: GridRowId, activities: ActivityRow[]) => {
      const updatedActivities = activities.filter(row => row.id !== activityId);
      const initiativeStats = updateStats(updatedActivities);
      let totalTicketEffort = null;
      const deletedActivity = activities.find(a => a.id === activityId);
      if (deletedActivity && deletedActivity.effort != null && deletedActivity.ticketKey) {
        totalTicketEffort = updatedActivities
          .filter(
            a =>
              a.ticketKey === deletedActivity.ticketKey &&
              a.actorId === deletedActivity.actorId &&
              a.effort != null
          )
          .reduce((totalEffort, activity) => totalEffort + activity.effort!, 0);
      }
      if (totalTicketEffort === 0) totalTicketEffort = null;

      setActivities(updatedActivities);
      const day = formatYYYYMMDD(selectedDay);
      submit(
        {
          activityId,
          day,
          initiativeStats,
          ticket:
            deletedActivity?.ticketKey ?
              {
                key: deletedActivity.ticketKey,
                effort: { [day]: { [deletedActivity.actorId!]: totalTicketEffort } },
              }
            : null,
        },
        deleteJsonOptions
      );
    },
    [selectedDay, submit, updateStats]
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
          findFirstTicket(row.metadata, row.description) ??
          getActivityDescription(row, { format: 'Grid' }), // sort by ticket or description
        editable: true /* see isCellEditable below for granularity */,
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => (
          <EditableCellField
            layout="text"
            hovered={params.row.hovered && params.row.eventType === CUSTOM_EVENT}
            label={
              <ActivityCard
                format="Grid"
                activity={params.row}
                ticketBaseUrl={loaderData.customerSettings?.ticketBaseUrl}
                actors={loaderData.actors}
                accountMap={loaderData.accountMap}
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
            hovered={params.row.hovered && params.row.eventType === CUSTOM_EVENT}
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
        field: 'initiativeId',
        headerName: 'Initiative',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: initiativeOptions,
        sortComparator: (a: string, b: string, paramA, paramB) =>
          gridStringOrNumberComparator(
            a ? loaderData.initiatives[a].key : '',
            b ? loaderData.initiatives[b].key : '',
            paramA,
            paramB
          ),
        editable: true,
        preProcessEditCellProps: (params: GridPreProcessEditCellProps<string>) => ({
          ...params.props,
          error:
            params.props.value &&
            params.row.ticketKey &&
            gridApiRef.current
              .getSortedRows()
              .some(
                a =>
                  a.id !== params.row.id &&
                  a.ticketKey === params.row.ticketKey &&
                  a.initiativeId &&
                  a.initiativeId !== params.props.value
              ),
        }),
        renderCell: params => (
          <Box height="100%" display="flex" alignItems="center">
            <EditableCellField
              layout="dropdown"
              hovered={params.row.hovered}
              label={
                <Box color={loaderData.initiatives[`${params.value}`]?.color ?? undefined}>
                  {params.value ?
                    (loaderData.initiatives[`${params.value}`]?.key ?? 'unknown')
                  : '⋯'}
                </Box>
              }
            />
          </Box>
        ),
        renderEditCell: params => <AutocompleteSelect {...params} options={initiativeOptions} />,
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
              label={params.value ? (PHASES.get(`${params.value}`)?.label ?? 'unknown') : undefined}
            />
          </Box>
        ),
        renderEditCell: params => <AutocompleteSelect {...params} options={phaseOptions} />,
      },
      {
        field: 'plannedHours',
        headerName: 'Planned hours',
        headerAlign: 'left',
        type: 'number',
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => {
          if (!fetchedTickets?.tickets || fetchedTickets.tickets.length === 0) return null;
          const ticket = fetchedTickets.tickets.find(t => t.key === params.row.ticketKey);
          if (!ticket) return null;
          return (
            <Box display="flex" height="100%" alignItems="center">
              <Tooltip
                title={
                  ticket.plannedHours == null ?
                    `Set planned hours for ${ticket.key} in the Tickets page`
                  : `Adjust planned hours for ${ticket.key} in the Tickets page`
                }
              >
                <Link href={`/tickets?q=${encodeURI(ticket.key)}`} target="_blank" sx={linkSx}>
                  {ticket.plannedHours ?? <AddIcon sx={{ width: 16, height: 16 }} />}
                </Link>
              </Tooltip>
            </Box>
          );
        },
      },
      {
        field: 'effort',
        headerName: 'Spent hours',
        headerAlign: 'left',
        type: 'number',
        editable: true,
        preProcessEditCellProps: (params: GridPreProcessEditCellProps<number>) => ({
          ...params.props,
          error: params.props.value != null && (params.props.value < 0 || params.props.value > 24),
        }),
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => (
          <EditableCellField layout="text" hovered={params.row.hovered} label={params.value} />
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        type: 'string',
        minWidth: 80,
        valueGetter: (_, row: ActivityRow) => inferTicketStatus(row.metadata),
      },
      {
        field: 'ongoing',
        headerName: 'Ongoing?',
        description: 'Duplicate the activity for the next day',
        type: 'boolean',
        editable: true,
        renderCell: (params: GridRenderCellParams<ActivityRow, number>) => (
          <>
            {params.row.previousActivityId && (
              <OngoingIcon fontSize="small" sx={{ opacity: 0.2 }} />
            )}
            {params.value ?
              <CheckIcon fontSize="small" sx={{ opacity: 0.6 }} />
            : <CloseIcon fontSize="small" sx={{ opacity: 0.2 }} />}
          </>
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
                      description:
                        params.row.description ?
                          `Delete the activity "${params.row.description}"?`
                        : 'Delete the activity?',
                    });
                    handleDeleteClick(params.id, gridApiRef.current.getSortedRows() as Activity[]);
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
      initiativeOptions,
      loaderData.actors,
      loaderData.customerSettings?.ticketBaseUrl,
      loaderData.accountMap,
      loaderData.initiatives,
      gridApiRef,
      confirm,
      handleDeleteClick,
      fetchedTickets?.tickets,
    ]
  );

  let datePickerFormat = 'MMM Do';
  if (isTodaySelected) {
    datePickerFormat = 'Today';
  } else if (isYesterday(selectedDay)) {
    datePickerFormat = 'Yesterday';
  }

  const dialog = (
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
              onChange={artifact =>
                setNewActivity({ ...newActivity, artifact: artifact as Artifact })
              }
              label="Artifact"
              items={artifactOptions}
            />
          </Stack>
          <Box sx={{ ml: '-30px' }}>
            <Grid container spacing={3}>
              <Grid>
                <SelectField
                  value={newActivity.initiativeId}
                  onChange={initiativeId => setNewActivity({ ...newActivity, initiativeId })}
                  label="Initiative"
                  items={initiativeOptions}
                />
              </Grid>
              <Grid>
                <SelectField
                  value={newActivity.phase ?? ''}
                  onChange={phase => setNewActivity({ ...newActivity, phase: phase as Phase })}
                  label="Phase"
                  items={phaseOptions}
                />
              </Grid>
              <Grid>
                <SelectField
                  value={`${!newActivity.priority || newActivity.priority == -1 ? '' : newActivity.priority}`}
                  onChange={priority =>
                    setNewActivity({ ...newActivity, priority: +priority ?? -1 })
                  }
                  label="Priority"
                  items={priorityOptions}
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
  );

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      identityId={loaderData.identityId}
      userName={loaderData.userDisplayName}
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
      {dialog}
      <BoxPopover popover={popover} onClose={() => setPopover(null)} showClose={true} />
      <Grid container sx={{ m: 3, ml: 0 }}>
        <Grid>
          <Stack sx={{ mb: 4 }}>
            <Box sx={{ ml: 3, mr: 1, mb: 3 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  slotProps={{ textField: { size: 'small', sx: { width: '160px' } } }}
                  value={selectedDay}
                  format={datePickerFormat}
                  onChange={day => {
                    if (day) {
                      setSelectedDay(day);
                      setSearchParams(prev =>
                        getSearchParam(prev, SEARCH_PARAM_DAY, formatYYYYMMDD(day))
                      );
                    }
                  }}
                />
              </LocalizationProvider>
            </Box>
            <Stack spacing={1} useFlexGap sx={{ ml: 3 }}>
              <Typography fontSize="small" fontWeight={500}>
                Activities for
              </Typography>
              <Box>
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
              {loaderData.reportIds
                ?.filter(
                  actorId =>
                    !groupFilter ||
                    loaderData.identities.find(i => i.id === actorId)?.groups?.includes(groupFilter)
                )
                .map(reportId => (
                  <Box key={reportId} sx={{ opacity: showTeam ? undefined : 0.3 }}>
                    <SmallAvatarChip name={loaderData.actors[reportId]?.name} />
                  </Box>
                ))}
              {loaderData.groups?.length && (
                <FilterMenu
                  label="User Group"
                  chips={true}
                  sx={{ width: 160, mt: 3 }}
                  selectedValue={groupFilter}
                  items={[
                    { value: '', label: 'None', color: theme.palette.grey[500] },
                    ...loaderData.groups.map(group => ({ value: group.id, label: group.name })),
                  ]}
                  onChange={value => setGroupFilter(value as string)}
                />
              )}
            </Stack>
          </Stack>
        </Grid>
        <Grid flex={1} minWidth={300}>
          <Stack spacing={2} sx={{ ml: 2 }}>
            <Stack direction="row">
              <IconButton onClick={previousDay} title="Previous day">
                <ArrowLeftIcon />
              </IconButton>
              <IconButton onClick={nextDay} title="Next day">
                <ArrowRightIcon />
              </IconButton>
              <Box flex={1} />
              <Button
                onClick={() => {
                  setNewActivity(emptyActivity);
                  setShowNewDialog(true);
                }}
                variant="contained"
                size="small"
                sx={{ borderRadius: 8, px: 2, textTransform: 'none' }}
              >
                Post a custom activity
              </Button>
            </Stack>
            <StyledMuiError>
              <DataGridWithSingleClickEditing
                apiRef={gridApiRef}
                columns={columns}
                rows={activities}
                loading={activitiesFetcher.state !== 'idle'}
                {...dataGridCommonProps}
                rowHeight={50}
                slotProps={{
                  row: {
                    onMouseEnter: e =>
                      setActivities(
                        activities.map(activity => ({
                          ...activity,
                          hovered: activity.id === e.currentTarget.getAttribute('data-id'),
                        }))
                      ),
                    onMouseLeave: () =>
                      setActivities(activities.map(activity => ({ ...activity, hovered: false }))),
                  },
                }}
                isCellEditable={(params: GridCellParams<Activity>) => {
                  if (
                    params.field === 'initiativeId' ||
                    params.field === 'phase' ||
                    params.field === 'effort' ||
                    params.field === 'ongoing'
                  ) {
                    return true;
                  }
                  return (
                    (params.field === 'description' || params.field === 'priority') &&
                    params.row.eventType === CUSTOM_EVENT
                  );
                }}
                processRowUpdate={(updatedRow: ActivityRow, oldRow: ActivityRow) => {
                  if (
                    updatedRow.description !== oldRow.description ||
                    updatedRow.priority != oldRow.priority ||
                    updatedRow.initiativeId !== oldRow.initiativeId ||
                    updatedRow.phase !== oldRow.phase ||
                    updatedRow.effort !== oldRow.effort ||
                    updatedRow.ongoing != oldRow.ongoing
                  ) {
                    const activityStats = groupActorActivities([updatedRow]);
                    updatedRow.ticketKey = activityStats.tickets[0]?.key;
                    const updatedActivities = activities.map(activity =>
                      activity.id === updatedRow.id ? { ...updatedRow } : activity
                    );
                    setActivities(updatedActivities);
                    const initiativeStats = updateStats(updatedActivities);
                    let totalTicketEffort = null;
                    if (updatedRow.effort != null && updatedRow.ticketKey) {
                      totalTicketEffort = activities
                        .filter(
                          a =>
                            a.id !== updatedRow.id &&
                            a.ticketKey === updatedRow.ticketKey &&
                            a.actorId === updatedRow.actorId &&
                            a.effort != null
                        )
                        .reduce(
                          (totalEffort, activity) => totalEffort + activity.effort!,
                          updatedRow.effort
                        );
                    }
                    if (updatedRow.effort == null && oldRow.effort != null) {
                      const activityEfforts = activities.filter(
                        a =>
                          a.id !== updatedRow.id &&
                          a.ticketKey === updatedRow.ticketKey &&
                          a.effort != null
                      );
                      if (activityEfforts.length > 0) {
                        totalTicketEffort = activityEfforts.reduce(
                          (totalEffort, activity) => totalEffort + activity.effort!,
                          0
                        );
                      }
                    }
                    let ticketInitiativeId = updatedRow.initiativeId;
                    if (!ticketInitiativeId && oldRow.initiativeId != null) {
                      // the ticket might still have the initiative in other activities (FIXME multiple initiatives per activity/ticket)
                      if (
                        activities.some(
                          a =>
                            a.id !== updatedRow.id &&
                            a.initiativeId === oldRow.initiativeId &&
                            a.ticketKey === updatedRow.ticketKey
                        )
                      ) {
                        ticketInitiativeId = oldRow.initiativeId;
                      }
                    }
                    const day = formatYYYYMMDD(selectedDay);
                    submit(
                      {
                        activityId: updatedRow.id,
                        description: updatedRow.description ?? null,
                        priority: updatedRow.priority ? +updatedRow.priority : -1,
                        initiativeId: updatedRow.initiativeId ?? null,
                        phase: updatedRow.phase ?? null,
                        effort: updatedRow.effort ?? null,
                        ongoing: updatedRow.ongoing ?? null,
                        actorId: updatedRow.actorId ?? null,
                        ...(updatedRow.ongoing && {
                          eventType: updatedRow.eventType,
                          action: updatedRow.action,
                          artifact: updatedRow.artifact,
                          createdTimestamp: updatedRow.createdTimestamp,
                          timestamp: updatedRow.timestamp,
                          initiativeId: updatedRow.initiativeId,
                          metadata: updatedRow.metadata,
                        }),
                        day,
                        initiativeStats,
                        ticket:
                          activityStats.tickets.length ?
                            {
                              ...activityStats.tickets[0],
                              initiativeId: ticketInitiativeId ?? null,
                              effort: { [day]: { [updatedRow.actorId!]: totalTicketEffort } },
                            }
                          : null,
                      },
                      postJsonOptions
                    );
                  }
                  return updatedRow;
                }}
                onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save status'))}
              />
            </StyledMuiError>
            {!isMobile && (
              <HelperText>
                {activities.length > 0 && (
                  <>
                    <p>
                      Some cells editable by clicking on them. Hours will be aggregated by ticket.
                      Limited to one single initiative per ticket.
                    </p>
                    <p>
                      Use the{' '}
                      <SmallButton
                        href="/tickets/"
                        label="Tickets"
                        icon={<TicketIcon fontSize="small" />}
                      />{' '}
                      page to set and adjust <strong>planned hours</strong>.
                    </p>
                  </>
                )}
                <p>
                  Press <code>N</code> to create a custom activity, <code>[</code> and{' '}
                  <code>]</code> to go to previous/next day.
                </p>
              </HelperText>
            )}
            {loaderData.isLocal && (
              <Typography component="pre" fontSize="10px" fontFamily="Roboto Mono, monospace">
                {formatJson(groupedActivities)}
              </Typography>
            )}
          </Stack>
        </Grid>
      </Grid>
    </App>
  );
}
