import FilterListIcon from '@mui/icons-material/FilterList';
import GitHubIcon from '@mui/icons-material/GitHub';
import PersonIcon from '@mui/icons-material/Person';
import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';

import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoaderFunctionArgs, MetaFunction, redirect } from '@remix-run/node';
import { useLoaderData, useLocation, useNavigate } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import pino from 'pino';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import { firestore as firestoreClient } from '../firebase.client';
import {
  fetchActorMap,
  fetchInitiativeMap,
  fetchTicketMap,
} from '../firestore.server/fetchers.server';
import {
  UserActivityRow,
  artifactActions,
  buildArtifactActionKey,
  userActivityRows,
} from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import {
  actionColDef,
  dataGridCommonProps,
  dateColdDef,
  metadataActionsColDef,
  priorityColDef,
  summaryColDef,
} from '../utils/dataGridUtils';
import { DATE_RANGE_LOCAL_STORAGE_KEY, DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { internalLinkSx, stickySx } from '../utils/jsxUtils';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { caseInsensitiveCompare, removeSpaces } from '../utils/stringUtils';
import theme from '../utils/theme';

const logger = pino({ name: 'route:activity.user' });

const ALL = '*';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'User';
  if (data?.userId && data.userId !== ALL) {
    title = data.actors[data.userId]?.name ?? 'User';
  }
  return [{ title: `${title} Activity | ROAKIT` }];
};

// verify JWT, load initiatives and users
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve initiatives, tickets, and users
    const [initiatives, actors, tickets] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
      fetchTicketMap(sessionData.customerId),
    ]);
    return {
      customerId: sessionData.customerId,
      userId: params.userid,
      initiatives,
      tickets,
      actors,
    };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function UserActivity() {
  const sessionData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const isHydrated = useHydrated();
  const actionFilter = isHydrated && location.hash ? location.hash.slice(1) : '';
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const prevDateFilter = usePrevious(dateFilter);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const prevSortAlphabetically = usePrevious(sortAlphabetically);
  const [scrollToActor, setScrollToActor] = useState<string | undefined>(undefined);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [error, setError] = useState('');

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const allUsersSnapshot = useRef<{ key: string; values: UserActivityRow[] }[]>();
  const [activities, setActivities] = useState<Map<string, UserActivityRow[]>>(new Map());

  const actorElementId = (actor: string) => `ACTOR-${removeSpaces(actor)}`;

  // Firestore listener
  useEffect(() => {
    const sortAndSetAllUsersActivities = () => {
      if (allUsersSnapshot.current) {
        setActivities(
          sortMap(allUsersSnapshot.current, (a, b) =>
            sortAlphabetically ?
              caseInsensitiveCompare(
                sessionData.actors[a.key]?.name ?? '',
                sessionData.actors[b.key]?.name ?? ''
              )
            : b.count - a.count
          )
        );
      }
    };

    const setRows = (querySnapshot: firebase.firestore.QuerySnapshot) => {
      try {
        if (sessionData.userId !== ALL) {
          setActivities(
            new Map([
              [sessionData.userId!, userActivityRows(querySnapshot, sessionData.tickets, false)],
            ])
          );
        } else {
          allUsersSnapshot.current = groupByArray(
            userActivityRows(querySnapshot, sessionData.tickets, true),
            'actorId'
          );
          sortAndSetAllUsersActivities();
        }
        setGotSnapshot(true);
      } catch (e: unknown) {
        setError(errMsg(e, 'Error parsing user activities'));
      }
    };

    if (!dateFilter || !sessionData.userId) {
      return;
    }

    if (
      sessionData.userId === ALL &&
      dateFilter === prevDateFilter &&
      sortAlphabetically !== prevSortAlphabetically &&
      allUsersSnapshot.current
    ) {
      // just re-sort
      return sortAndSetAllUsersActivities();
    }

    setError('');
    setGotSnapshot(false);
    const startDate = dateFilterToStartDate(dateFilter);
    const query =
      sessionData.userId === ALL ?
        firestoreClient
          .collection(`customers/${sessionData.customerId}/activities/`)
          .orderBy('createdTimestamp')
          .startAt(startDate)
          .limit(5000) // FIXME limit
      : firestoreClient
          .collection(`customers/${sessionData.customerId}/activities/`)
          .where('actorAccountId', '==', sessionData.userId)
          .orderBy('createdTimestamp')
          .startAt(startDate)
          .limit(1000); // FIXME limit
    const unsubscribe = query.onSnapshot(
      snapshot => setRows(snapshot),
      error => setError(error.message)
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dateFilter,
    prevDateFilter,
    sessionData.actors,
    sessionData.customerId,
    sessionData.userId,
    sortAlphabetically,
  ]); // prevSortAlphabetically must be omitted

  // Auto scrollers
  useEffect(() => {
    if (scrollToActor) {
      const element = document.getElementById(actorElementId(scrollToActor));
      setScrollToActor(undefined);
      if (element) {
        setTimeout(
          () =>
            window.scrollTo({
              top: element.getBoundingClientRect().top + window.scrollY - 54,
              behavior: 'smooth',
            }),
          0
        );
      }
    }
  }, [scrollToActor]);

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColdDef({ field: 'date' }),
      actionColDef({ field: 'action' }),
      priorityColDef({ field: 'priority' }),
      {
        field: 'initiativeId',
        headerName: 'Initiative',
        width: 80,
        renderCell: params => {
          const initiativeId = params.value as string;
          return initiativeId ?
              <Box title={sessionData.initiatives[initiativeId]?.label}>{initiativeId}</Box>
            : <Box color={theme.palette.grey[400]}>unset</Box>;
        },
      },
      summaryColDef({ field: 'metadata' }, (element, content) => setPopover({ element, content })),
      metadataActionsColDef({}, (element: HTMLElement, metadata: unknown) =>
        setCodePopover({ element, content: metadata })
      ),
    ],
    [sessionData.initiatives]
  );

  const filteredActivities = new Map(activities);
  const grids = [...activities].map(([actorId, rows]) => {
    if (actionFilter) {
      rows = rows.filter(a => buildArtifactActionKey(a.artifact, a.action) === actionFilter);
      if (rows.length) {
        filteredActivities.set(actorId, rows);
      } else {
        filteredActivities.delete(actorId);
      }
    }
    return (
      !!rows.length && (
        <Stack id={actorElementId(actorId)} key={actorId} sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            alignItems="center"
            color={theme.palette.grey[600]}
            sx={{ display: 'flex', mb: 1 }}
          >
            <PersonIcon sx={{ mr: 1 }} />
            {sessionData.actors[actorId]?.name ?? 'Unknown user'}
            {sessionData.actors[actorId]?.url && (
              <IconButton
                component="a"
                href={sessionData.actors[actorId].url}
                target="_blank"
                color="primary"
                sx={{ ml: 1 }}
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            )}
          </Typography>
          <DataGrid
            columns={columns}
            rows={rows}
            {...dataGridCommonProps}
            rowHeight={50}
            slots={{
              noRowsOverlay: () => (
                <Box height="75px" display="flex" alignItems="center" justifyContent="center">
                  No activity for these dates
                </Box>
              ),
            }}
          />
        </Stack>
      )
    );
  });

  return (
    <App
      view="activity.user"
      isLoggedIn={true}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
    >
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={sessionData.customerId}
      />
      <Popover
        id={popover?.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={() => setPopover(null)}
        onClick={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ py: 1 }}>{popover?.content}</Box>
      </Popover>
      <Stack sx={{ m: 3 }}>
        {activities.size === 0 && gotSnapshot ?
          <Typography textAlign="center" sx={{ m: 4 }}>
            No activity for these dates
          </Typography>
        : <Stack direction="row">
            {sessionData.userId === ALL && (
              <Box sx={{ display: 'flex', mr: 2 }}>
                <Box sx={{ position: 'relative' }}>
                  <Box fontSize="small" color={theme.palette.grey[700]} sx={{ ...stickySx }}>
                    <FormGroup sx={{ mb: 2, ml: 2 }}>
                      {filteredActivities.size > 0 && gotSnapshot && (
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={sortAlphabetically}
                              onChange={e => {
                                setSortAlphabetically(e.target.checked);
                                window.scrollTo({ top: 0 });
                              }}
                            />
                          }
                          label="Sort alphabetically"
                          title="Sort alphabetically or by activity count"
                          disableTypography
                        />
                      )}
                    </FormGroup>
                    {[...filteredActivities.keys()].map(actorId => (
                      <Box key={actorId}>
                        <Link sx={internalLinkSx} onClick={() => setScrollToActor(actorId)}>
                          {sessionData.actors[actorId]?.name ?? 'Unknown'}
                        </Link>
                        {` (${filteredActivities.get(actorId)?.length ?? 0})`}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <FilterListIcon />
                <FormControl size="small">
                  <InputLabel>Filter</InputLabel>
                  <Select
                    id="action-filter"
                    value={actionFilter ?? ''}
                    label="Filter"
                    sx={{ minWidth: '250px' }}
                    onChange={e => {
                      if (e.target.value) {
                        navigate('#' + e.target.value);
                      } else {
                        navigate('');
                      }
                    }}
                  >
                    <MenuItem key={0} value={''}>
                      <Typography color={theme.palette.grey[500]}>{'None'}</Typography>
                    </MenuItem>
                    {[...artifactActions].map(([key, action]) => (
                      <MenuItem key={key} value={key}>
                        {action.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              {grids}
            </Stack>
          </Stack>
        }
        {error && (
          <Alert severity="error" variant="standard" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
