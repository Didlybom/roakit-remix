import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Unstable_Grid2 as Grid,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { gridStringOrNumberComparator, type GridColDef } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ActionFunctionArgs, LoaderFunctionArgs, type TypedResponse } from '@remix-run/node';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import dayjs, { Dayjs } from 'dayjs';
import pino from 'pino';
import { useEffect, useMemo, useState } from 'react';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  compileActivityMappers,
  mapActivity,
  MapperType,
} from '../activityProcessors/activityMapper';
import App from '../components/App';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import AutocompleteSelect, { type SelectOption } from '../components/datagrid/AutocompleteSelect';
import {
  actorColDef,
  dataGridCommonProps,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  StyledMuiError,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import type { Account, Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { formatYYYYMMDD, isToday, isValidDate, isYesterday } from '../utils/dateUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { errorAlert, loaderErrorResponse, loginWithRedirectUrl } from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import { ActivityResponse } from './fetcher.activities.($userid)';

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
      fetchAccountMap(sessionData.customerId!),
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

interface ActionRequest {
  day?: string;
  activityId: string;
  launchItemId: string;
  effort: number;
}

interface ActionResponse {
  status?: 'saved';
  error?: string;
}

export const action = async ({
  params,
  request,
}: ActionFunctionArgs): Promise<TypedResponse<never> | ActionResponse> => {
  const sessionData = await loadSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;

  // save activity
  if (actionRequest.day) {
    let identityId = params.userid; // impersonification
    if (!identityId) {
      const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
      identityId = identity.id;
    }

    if (!identityId) {
      throw 'Identity required';
    }

    await firestore
      .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
      .update({
        launchItemId: actionRequest.launchItemId ?? '',
        effort: actionRequest.effort,
      });

    return { status: 'saved' };
  }

  return { status: undefined };
};

type ActivityRow = Omit<Activity, 'launchItemId'> & { launchItem: SelectOption };

export default function Status() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
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
  const [showTeam, setShowTeam] = useState(false);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
  }, [loaderData.initiatives, loaderData.launchItems]);

  // load activities for the selected day
  useEffect(() => {
    if (!isValidDate(selectedDay)) {
      setError('Invalid date');
      return;
    }
    activitiesFetcher.load(
      `/fetcher/activities/${loaderData.userId ?? ''}?${showTeam ? 'includeTeam=true&' : ''}start=${selectedDay.startOf('day').valueOf()}&end=${selectedDay.endOf('day').valueOf()}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, showTeam]); // activitiesFetcher and loaderData must be omitted

  // handle fetched activities
  useEffect(() => {
    if (!fetchedActivities?.activities) {
      return;
    }
    const activityRows: ActivityRow[] = [];
    const activities = Object.values(fetchedActivities.activities);
    activities.forEach(activity => {
      if (!activity.initiativeId || !activity.launchItemId) {
        const mapping = mapActivity(activity);
        if (!activity.initiativeId) {
          activity.initiativeId = mapping.initiatives[0] ?? '';
        }
        if (!activity.launchItemId) {
          activity.launchItemId = mapping.launchItems[0] ?? '';
        }
        const { launchItemId, ...activityFields } = activity;
        activityRows.push({
          ...activityFields,
          initiativeId: activity.initiativeId || mapping?.initiatives[0] || '',
          launchItem: { value: launchItemId || mapping?.launchItems[0] || '' },
          actorId:
            activity.actorId ?
              loaderData.accountMap[activity.actorId] ?? activity.actorId // resolve identity
            : undefined,
        });
      }
    });
    setActivities(activityRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities]); // loaderData and activities must be omitted

  // handle save results and AI results
  useEffect(() => {
    if (!actionData) {
      return;
    }
    if (actionData.status === 'saved') {
      setShowSavedConfirmation(true);
    }
  }, [actionData]);

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

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({
        field: 'timestamp',
        minWidth: 100,
        valueGetter: value => (value ? new Date(value) : value),
      }),
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

      descriptionColDef({ field: 'metadata' }, (element, content) =>
        setPopover({ element, content })
      ),
      priorityColDef({ field: 'priority' }),
      {
        field: 'launchItem',
        headerName: 'Launch',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: launchItemOptions,
        sortComparator: (a: SelectOption, b: SelectOption, paramA, paramB) =>
          gridStringOrNumberComparator(
            a.value ? loaderData.launchItems[a.value].key : '',
            b.value ? loaderData.launchItems[b.value].key : '',
            paramA,
            paramB
          ),
        editable: true,
        renderCell: params => {
          const option = params.value as SelectOption;
          return (
            <Box>
              <Button
                color="inherit"
                endIcon={<ArrowDropDownIcon />}
                sx={{ ml: -1, fontWeight: '400', textTransform: 'none' }}
              >
                <Box color={loaderData.launchItems[option.value]?.color ?? undefined}>
                  {option.value ? loaderData.launchItems[option.value]?.key ?? 'unknown' : '⋯'}
                </Box>
              </Button>
            </Box>
          );
        },
        renderEditCell: params => <AutocompleteSelect {...params} options={launchItemOptions} />,
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
          <Box sx={{ cursor: ' pointer' }}>{(params.value as number) ?? '⋯'}</Box>
        ),
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ],
    [showTeam, launchItemOptions, loaderData.actors, loaderData.launchItems]
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
        open={showSavedConfirmation}
        autoHideDuration={2000}
        onClose={(_, reason) => (reason === 'clickaway' ? null : setShowSavedConfirmation(false))}
        message={'Saved'}
      />
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyActivityId: true }}
      />
      <BoxPopover popover={popover} onClose={() => setPopover(null)} showClose={true} />
      <Grid container columns={2} sx={{ m: 3, ml: 0 }}>
        <Grid>
          <Stack sx={{ mb: 4 }}>
            <Box sx={{ ml: 3, mr: 1, mb: 3 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  disableFuture={true}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: '160px' },
                    },
                  }}
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
            <StyledMuiError>
              <DataGridWithSingleClickEditing
                columns={columns}
                rows={activities}
                loading={activitiesFetcher.state !== 'idle'}
                {...dataGridCommonProps}
                rowHeight={50}
                processRowUpdate={(updatedRow: ActivityRow, oldRow: ActivityRow) => {
                  if (
                    updatedRow.launchItem.value !== oldRow.launchItem.value ||
                    updatedRow.effort !== oldRow.effort
                  ) {
                    submit(
                      {
                        day: formatYYYYMMDD(selectedDay),
                        activityId: updatedRow.id,
                        launchItemId: updatedRow.launchItem.value,
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
