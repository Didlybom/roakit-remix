import {
  Alert,
  Box,
  Button,
  FormControl,
  Unstable_Grid2 as Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import {
  GridColDef,
  GridDensity,
  GridFeatureMode,
  GridRowSelectionModel,
  GridSortDirection,
  GridToolbarContainer,
} from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import { MapperType, compileActivityMappers, mapActivity } from '../activityMapper/activityMapper';
import App from '../components/App';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import {
  actionColDef,
  actorColDef,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
  fetchTicketPriorityMapWithCache,
} from '../firestore.server/fetchers.server';
import { incrementInitiativeCounters } from '../firestore.server/updaters.server';
import { usePrevious } from '../hooks/usePrevious';
import { identifyAccounts, inferPriority } from '../types/activityFeed';
import type { Account, Activity, ActivityCount, Artifact } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import {
  errorAlert,
  internalLinkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
} from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import theme from '../utils/theme';
import type { ActivityPageResponse } from './fetcher.activities.page';

const logger = pino({ name: 'route:activity' });

const MAX_BATCH = 500;
const UNSET_INITIATIVE_ID = '_UNSET_INITIATIVE_';
const DELETE = '_DELETE_';

export const meta = () => [{ title: 'Activity | ROAKIT' }];

const VIEW = View.Activity;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const [initiatives, launchItems, accounts, identities, tickets] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchTicketPriorityMapWithCache(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      initiatives,
      launchItems,
      actors,
      accountMap: identities.accountMap,
      tickets,
    };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

type ActivityRow = Activity & { note?: string };
type ActivityPayload = { id: string; artifact: Artifact; createdTimestamp: number }[];

interface JsonRequest {
  activityId?: string;
  activities?: ActivityPayload;
  initiativeId?: string;
  initiativeCountersLastUpdated?: number;
  note?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);

  try {
    const customerId = sessionData.customerId;

    const jsonRequest = (await request.json()) as JsonRequest;

    const note = jsonRequest.note;
    if (note) {
      const activityId = jsonRequest.activityId;
      await firestore
        .doc(`customers/${customerId!}/activities/${activityId}`)
        .update({ note: note === DELETE ? '' : note });
      return null;
    }

    const { activities, initiativeId, initiativeCountersLastUpdated } = jsonRequest;
    if (!activities || !initiativeId) {
      return null;
    }
    const counters: ActivityCount = { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 };
    const batch = firestore.batch();
    activities.forEach(activity => {
      if (
        initiativeId !== UNSET_INITIATIVE_ID &&
        initiativeCountersLastUpdated &&
        activity.createdTimestamp < initiativeCountersLastUpdated
      ) {
        counters[activity.artifact]++;
      }
      const activityDoc = firestore.doc('customers/' + customerId + '/activities/' + activity.id);
      batch.update(activityDoc, {
        initiative: initiativeId === UNSET_INITIATIVE_ID ? '' : initiativeId,
      });
    });
    await batch.commit(); // up to 500 operations

    //  update the initiative counters
    if (initiativeId !== UNSET_INITIATIVE_ID) {
      await incrementInitiativeCounters(customerId!, initiativeId, counters);
    }
    // FIXME decrement the activities that had an initiative and were changed

    return null;
  } catch (e) {
    logger.error(e);
    throw new Response(`Failed to save data. ${errMsg(e)}`, { status: 500 });
  }
};

type ShowActivity = '' | 'withInitiatives' | 'withoutInitiatives';

export default function ActivityReview() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const assignInitiativeFetcher = useFetcher();
  const loaderData = useLoaderData<typeof loader>();
  const activitiesFetcher = useFetcher();
  const fetchedActivities = activitiesFetcher.data as ActivityPageResponse;
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [activityFilter, setActivityFilter] = useState<ShowActivity>('');
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);
  const [bulkInitiative, setBulkInitiative] = useState('');
  const [rowTotal, setRowTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const prevPaginationModel = usePrevious(paginationModel);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loaderData.initiatives) {
      compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    }
    if (loaderData.launchItems) {
      compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
    }
  }, [loaderData.initiatives, loaderData.launchItems]);

  useEffect(() => {
    if (fetchedActivities?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivities?.error, navigate]);

  useEffect(() => {
    setError('');
    let query = `/fetcher/activities/page?limit=${paginationModel.pageSize}`;
    if (activityFilter) {
      query += `&withInitiatives=${activityFilter == 'withInitiatives' ? true : false}`;
    }
    if (prevPaginationModel && activities?.length && paginationModel.page > 0) {
      // if concerned with activities at the same millisecond, use a doc snapshot instead of createdTimestamp (requiring fetching it though)
      // https://firebase.google.com/docs/firestore/query-data/query-cursors#use_a_document_snapshot_to_define_the_query_cursor
      if (prevPaginationModel.page < paginationModel.page) {
        query += `&startAfter=${activities[activities.length - 1].timestamp}`;
      } else if (prevPaginationModel.page > paginationModel.page) {
        query += `&endBefore=${activities[0].timestamp}`;
      } else {
        // reachable on dev hot reload, then page is the same but we are reloading UI
        return;
      }
    }
    activitiesFetcher.load(query);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilter, paginationModel]); // sessionData, prevPaginationModel and boundaryTimestamps must be omitted

  // handle fetched activities
  useEffect(() => {
    if (!fetchedActivities?.activities || fetchedActivities?.activityTotal == null) {
      return;
    }
    const activityData: Activity[] = [];
    fetchedActivities.activities.forEach((activity: Activity) => {
      let priority = activity.priority;
      if ((priority == null || priority === -1) && activity.metadata) {
        priority = inferPriority(loaderData.tickets, activity.metadata);
      }
      let mapping;
      if (!activity.initiativeId || !activity.launchItemId) {
        mapping = mapActivity(activity);
      }
      activityData.push({
        ...activity,
        actorId:
          activity.actorId ?
            loaderData.accountMap[activity.actorId] ?? activity.actorId // resolve identity
          : undefined,
        priority,
        initiativeId: activity.initiativeId || mapping?.initiatives[0] || UNSET_INITIATIVE_ID,
        launchItemId: activity.launchItemId || mapping?.launchItems[0] || '',
      });
    });
    setActivities(activityData);
    setRowTotal(fetchedActivities.activityTotal);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities]); // loaderData and activities must be omitted

  const dataGridProps = {
    autosizeOnMount: true,
    autoHeight: true, // otherwise empty state looks ugly
    sx: { fontSize: 'small' },
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    checkboxSelection: true,
    paginationMode: 'server' as GridFeatureMode,
    pageSizeOptions: [25, 50, 100],
    sortingOrder: ['asc', 'desc'] as GridSortDirection[],
  };

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({ field: 'timestamp', valueGetter: value => new Date(value) }),
      actorColDef({
        field: 'actor',
        valueGetter: (_, row) => {
          const fields = row as Activity;
          return fields.actorId ?
              ({
                id: fields.actorId,
                name: loaderData.actors[fields.actorId]?.name ?? 'unknown',
              } as Account)
            : '';
        },
        renderCell: params => {
          const fields = params.value as Account;
          return (
            <Link
              fontSize="small"
              href={`/activity/user/${encodeURI(fields.id)}`}
              title="View activity"
              sx={internalLinkSx}
            >
              {fields.name}
            </Link>
          );
        },
      }),
      actionColDef({ field: 'action' }),
      descriptionColDef({ field: 'metadata' }, (element, content) =>
        setPopover({ element, content })
      ),
      priorityColDef({ field: 'priority' }),
      {
        field: 'launchItemId',
        headerName: 'Launch',
        renderCell: params => {
          const launchItemId = params.value as string;
          return launchItemId ?
              <Box title={loaderData.launchItems[launchItemId]?.label}>
                {loaderData.launchItems[launchItemId]?.key}
              </Box>
            : null;
        },
      },
      {
        field: 'initiativeId',
        headerName: 'Goal',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: [
          { value: UNSET_INITIATIVE_ID, label: '[unset]' },
          ...Object.keys(loaderData.initiatives).map(initiativeId => {
            const initiative = loaderData.initiatives[initiativeId];
            return { value: initiativeId, label: `[${initiative.key}] ${initiative.label}` };
          }),
        ],
        editable: true,
        renderCell: params =>
          params.value !== UNSET_INITIATIVE_ID ?
            <Box fontSize="small" color={theme.palette.primary.main} sx={{ cursor: 'pointer' }}>
              {loaderData.initiatives[params.value as string]?.label ?? 'unknown'}
            </Box>
          : <Box fontSize="small" color={theme.palette.primary.main} sx={{ cursor: 'pointer' }}>
              {'...'}
            </Box>,
      },
      {
        field: 'note',
        headerName: 'Note',
        minWidth: 100,
        editable: true,
        sortable: false,
        renderCell: params => (
          <Box
            fontSize="small"
            color={theme.palette.primary.main}
            title={params.value as string}
            sx={{ cursor: 'pointer' }}
          >
            {params.value || '...'}
          </Box>
        ),
      },
      viewJsonActionsColDef({}, (element: HTMLElement, data: unknown) => {
        const { id, ...content } = data as Activity;
        setCodePopover({ element, content: { ...content, activityId: id } });
      }),
    ],
    [loaderData.actors, loaderData.initiatives, loaderData.launchItems]
  );

  function BulkToolbar() {
    return (
      <GridToolbarContainer>
        <Grid container spacing={1} sx={{ m: 1 }}>
          <Grid sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            {rowSelectionModel.length} {pluralize('activity', rowSelectionModel.length)} selected
          </Grid>
          <Grid>
            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel id="initiative">Add to goal</InputLabel>
              <Select
                id="initiative-select"
                value={bulkInitiative}
                label="Select an initiative"
                onChange={e => setBulkInitiative(e.target.value)}
                sx={{ minWidth: '250px' }}
              >
                {Object.keys(loaderData.initiatives).map(initiativeId => (
                  <MenuItem key={initiativeId} value={initiativeId}>
                    {`[${initiativeId}] ${loaderData.initiatives[initiativeId].label}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid sx={{ display: 'flex' }}>
            <Button
              disabled={!bulkInitiative || rowSelectionModel.length > MAX_BATCH}
              onClick={() => {
                setRowSelectionModel([]);
                if (!activities) {
                  return;
                }
                activities
                  .filter(a => rowSelectionModel.includes(a.id))
                  .forEach(activity => (activity.initiativeId = bulkInitiative));
                setActivities(activities);
                assignInitiativeFetcher.submit(
                  {
                    initiativeId: bulkInitiative,
                    initiativeCountersLastUpdated:
                      loaderData.initiatives[bulkInitiative]?.countersLastUpdated ?? null,
                    activities: rowSelectionModel.map(id => ({
                      id,
                      artifact: activities.find(a => a.id === id)!.artifact,
                    })) as ActivityPayload,
                  },
                  postJsonOptions
                );
              }}
            >
              Save
            </Button>
          </Grid>
        </Grid>
        {rowSelectionModel.length > MAX_BATCH && (
          <Alert severity="warning" sx={{ display: 'flex', bgcolor: 'inherit' }}>
            Please select no more than {MAX_BATCH} activities.
          </Alert>
        )}
      </GridToolbarContainer>
    );
  }

  if (!activities) {
    return (
      <App
        view={VIEW}
        isLoggedIn={true}
        role={loaderData.role}
        isNavOpen={loaderData.isNavOpen}
        showProgress={true}
      />
    );
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
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyBuckets: true }}
      />
      <BoxPopover popover={popover} onClose={() => setPopover(null)} />
      <Stack m={3}>
        <Grid container columns={2} spacing={2} alignItems="center" mb={2}>
          <Grid>
            {!!rowTotal && (
              <Typography variant="subtitle2">
                {rowTotal.toLocaleString()} total {pluralize('activity', rowTotal)}
              </Typography>
            )}
          </Grid>
          <Grid flex={1}>
            <FilterMenu
              label="Goal Filter"
              sx={{ justifyContent: 'right' }}
              selectedValue={activityFilter}
              items={[
                { value: '', label: 'All', color: grey[500] },
                { value: 'withoutInitiatives', label: 'Without goals' },
                { value: 'withInitiatives', label: 'With goals' },
              ]}
              onChange={value => {
                setPaginationModel({ ...paginationModel, page: 0 });
                setActivityFilter(value as ShowActivity);
              }}
            />
          </Grid>
        </Grid>
        <DataGridWithSingleClickEditing
          columns={columns}
          rows={activities}
          {...dataGridProps}
          rowCount={rowTotal}
          paginationModel={paginationModel}
          onPaginationModelChange={newPaginationModel => {
            if (paginationModel && paginationModel.pageSize !== newPaginationModel.pageSize) {
              setPaginationModel({ pageSize: newPaginationModel.pageSize, page: 0 });
            } else {
              setPaginationModel(newPaginationModel);
            }
          }}
          slots={{ toolbar: rowSelectionModel.length ? BulkToolbar : undefined }}
          processRowUpdate={(updatedRow: ActivityRow, oldRow: ActivityRow) => {
            if (updatedRow.initiativeId !== oldRow.initiativeId) {
              assignInitiativeFetcher.submit(
                {
                  initiativeId: updatedRow.initiativeId,
                  initiativeCountersLastUpdated:
                    loaderData.initiatives[updatedRow.initiativeId]?.countersLastUpdated ?? null,
                  activities: [
                    {
                      id: updatedRow.id,
                      artifact: updatedRow.artifact,
                      createdTimestamp: updatedRow.timestamp,
                    },
                  ] as ActivityPayload,
                },
                postJsonOptions
              );
            } else if (updatedRow.note !== oldRow.note) {
              assignInitiativeFetcher.submit(
                { activityId: updatedRow.id, note: updatedRow.note || DELETE },
                postJsonOptions
              );
            }
            return updatedRow;
          }}
          onRowSelectionModelChange={rowSelectionModel => {
            setRowSelectionModel(rowSelectionModel);
            if (!rowSelectionModel.length) {
              setBulkInitiative('');
            }
          }}
          rowSelectionModel={rowSelectionModel}
          onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to update'))}
        />
      </Stack>
    </App>
  );
}
