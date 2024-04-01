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
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, redirect } from '@remix-run/node';
import { useLoaderData, useLocation, useNavigate, useNavigation } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import pino from 'pino';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import usePrevious from 'use-previous';
import { appActions } from '../appActions.server';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import { firestore as firestoreClient } from '../firebase.client';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchTicketMap,
} from '../firestore.server/fetchers.server';
import { artifactActions, buildArtifactActionKey, identifyAccounts } from '../schemas/activityFeed';
import { Artifact, IdentityAccountMap, TicketMap, activitySchema } from '../schemas/schemas';
import { inferPriority } from '../utils/activityUtils';
import { loadSession } from '../utils/authUtils.server';
import {
  actionColDef,
  dataGridCommonProps,
  dateColdDef,
  metadataActionsColDef,
  priorityColDef,
  summaryColDef,
} from '../utils/dataGridUtils';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { ParseError, errMsg } from '../utils/errorUtils';
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

interface UserActivityRow {
  id: string;
  date: Date;
  action: string;
  event?: string;
  artifact: Artifact;
  initiativeId: string;
  priority?: number;
  actorId?: string;
  metadata: unknown;
  objectId?: string;
}

const userActivityRows = (
  snapshot: firebase.firestore.QuerySnapshot,
  tickets: TicketMap,
  accountMap: IdentityAccountMap
): UserActivityRow[] => {
  const rows: UserActivityRow[] = [];
  snapshot.forEach(doc => {
    const props = activitySchema.safeParse(doc.data());
    if (!props.success) {
      throw new ParseError('Failed to parse activities. ' + props.error.message);
    }
    let priority = props.data.priority;
    if (priority === undefined || priority === -1) {
      priority = inferPriority(tickets, props.data.metadata);
    }
    const row: UserActivityRow = {
      id: doc.id,
      date: new Date(props.data.createdTimestamp),
      action: props.data.action,
      event: props.data.event,
      artifact: props.data.artifact,
      initiativeId: props.data.initiative,
      priority,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metadata: props.data.metadata,
      actorId:
        props.data.actorAccountId ?
          accountMap[props.data.actorAccountId] ?? props.data.actorAccountId // resolve identity
        : undefined,
      objectId: props.data.objectId, // for debugging
    };
    rows.push(row);
  });
  return rows;
};

// verify JWT, load initiatives and users
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve initiatives, tickets, and users
    const [initiatives, accounts, identities, tickets] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchTicketMap(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const userId = params.userid;

    // all user ids candidate as activity keys (activities can use both identityIds and accountIds)
    const activityUserIds: string[] = [];
    if (userId && userId !== ALL) {
      const userIds = new Set([userId]);
      let identityId: string;
      if (identities.accountMap[userId]) {
        // if params.userId is not an identity, add the identity
        identityId = identities.accountMap[userId];
        userIds.add(identityId);
      } else {
        identityId = userId;
      }
      // add the other accounts for the identity
      identities.list
        .filter(identity => identity.id === identityId)
        .flatMap(identity => identity.accounts)
        .map(account => account.id)
        .forEach(accountId => userIds.add(accountId));

      activityUserIds.push(...userIds);
    }

    return {
      ...sessionData,
      userId,
      activityUserIds,
      initiatives,
      tickets,
      actors,
      accountMap: identities.accountMap,
    };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const formData = await request.formData();

  const appAction = await appActions(request, formData);
  if (appAction) {
    return appAction;
  }
};

export default function UserActivity() {
  const sessionData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const isHydrated = useHydrated();
  const actionFilter = isHydrated && location.hash ? location.hash.slice(1) : '';
  const prevActionFilter = usePrevious(actionFilter);
  const dateFilter = sessionData.dateFilter ?? DateRange.OneDay;
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const prevSortAlphabetically = usePrevious(sortAlphabetically);
  const [scrollToActor, setScrollToActor] = useState<string | undefined>(undefined);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [error, setError] = useState('');

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const snapshot = useRef<{ key: string; values: UserActivityRow[] }[]>();
  const [activities, setActivities] = useState<Map<string, UserActivityRow[]>>(new Map());

  const actorElementId = (actor: string) => `ACTOR-${removeSpaces(actor)}`;

  // Firestore listener
  useEffect(() => {
    const sortAndSetUserActivities = () => {
      if (snapshot.current) {
        const filteredSnapshot: { key: string; values: UserActivityRow[] }[] = [];
        if (actionFilter) {
          snapshot.current.forEach(user => {
            const values = user.values.filter(
              a => buildArtifactActionKey(a.artifact, a.action) === actionFilter
            );
            if (values.length > 0) {
              filteredSnapshot.push({ key: user.key, values });
            }
          });
        }
        setActivities(
          sortMap(actionFilter ? filteredSnapshot : snapshot.current, (a, b) =>
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
        snapshot.current = groupByArray(
          userActivityRows(querySnapshot, sessionData.tickets, sessionData.accountMap),
          'actorId'
        );
        sortAndSetUserActivities();
        setGotSnapshot(true);
      } catch (e: unknown) {
        setError(errMsg(e, 'Error parsing user activities'));
      }
    };

    if (!dateFilter || !sessionData.userId) {
      return;
    }

    if (
      (sortAlphabetically !== prevSortAlphabetically || actionFilter !== prevActionFilter) &&
      snapshot.current
    ) {
      // just re-filter and re-sort
      return sortAndSetUserActivities();
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
          .where('actorAccountId', 'in', sessionData.activityUserIds)
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
    sessionData.actors,
    sessionData.customerId,
    sessionData.userId,
    sortAlphabetically,
    actionFilter,
  ]); // prevSortAlphabetically and prevActionFilter must be omitted

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

  const grids = [...activities].map(([actorId, rows], i) => {
    const actor = sessionData.actors[actorId];
    return (
      !!rows.length && (
        <Stack id={actorElementId(actorId ?? '-')} key={i} sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            alignItems="center"
            color={theme.palette.grey[600]}
            sx={{ display: 'flex', mb: 1 }}
          >
            <PersonIcon sx={{ mr: 1 }} />
            {actor?.name ?? 'Unknown user'}
            {(actor?.urls?.length ?? 0) > 0 && (
              <IconButton
                component="a"
                href={actor.urls![0].url} /* FIXME urls */
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
      isNavOpen={sessionData.isNavOpen}
      dateRange={dateFilter}
      showProgress={!gotSnapshot || navigation.state === 'submitting'}
      showPulse={true}
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
        <Stack direction="row">
          {sessionData.userId === ALL && (
            <Box sx={{ display: 'flex', mr: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Box fontSize="small" color={theme.palette.grey[700]} sx={{ ...stickySx }}>
                  <FormGroup sx={{ mb: 2, ml: 2 }}>
                    {activities.size > 0 && gotSnapshot && (
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
                  {[...activities.keys()].map((actorId, i) => (
                    <Box key={i}>
                      <Link sx={internalLinkSx} onClick={() => setScrollToActor(actorId)}>
                        {sessionData.actors[actorId]?.name ?? 'Unknown'}
                      </Link>
                      {` (${activities.get(actorId)?.length ?? 0})`}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="right"
              sx={{ mb: 2 }}
            >
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
        {error && (
          <Alert severity="error" variant="standard" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
