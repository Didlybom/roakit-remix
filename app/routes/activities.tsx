import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
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
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  MapperType,
  compileActivityMappers,
  mapActivity,
} from '../activityProcessors/activityMapper';
import App from '../components/App';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import type { SelectOption } from '../components/datagrid/AutocompleteSelect';
import AutocompleteSelect from '../components/datagrid/AutocompleteSelect';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import {
  actionColDef,
  actorColDef,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  sortComparatorKeepingNullAtTheBottom,
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
import type { Account, Activity, ActivityCount, Artifact } from '../types/types';
import { inferPriority } from '../utils/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import {
  ellipsisSx,
  errorAlert,
  internalLinkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
} from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import theme from '../utils/theme';
import type { ActivityPageResponse } from './fetcher.activities.page';

const logger = pino({ name: 'route:activities' });

const MAX_BATCH = 500;
const DELETE = '_DELETE_';

export const meta = () => [{ title: 'All Activity | ROAKIT' }];

const VIEW = View.AllActivity;

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

type ActivityRow = Omit<Activity, 'initiativeId'> & { initiative: SelectOption; note?: string };
type ActivityPayload = { id: string; artifact: Artifact; createdTimestamp: number }[];

interface ActionRequest {
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

    const actionRequest = (await request.json()) as ActionRequest;

    const note = actionRequest.note;
    if (note) {
      const activityId = actionRequest.activityId;
      await firestore
        .doc(`customers/${customerId!}/activities/${activityId}`)
        .update({ note: note === DELETE ? '' : note });
      return null;
    }

    const { activities, initiativeId, initiativeCountersLastUpdated } = actionRequest;
    if (!activities) {
      return null;
    }
    const counters: ActivityCount = { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 };
    const batch = firestore.batch();
    activities.forEach(activity => {
      if (
        initiativeId &&
        initiativeCountersLastUpdated &&
        activity.createdTimestamp < initiativeCountersLastUpdated
      ) {
        counters[activity.artifact]++;
      }
      const activityDoc = firestore.doc('customers/' + customerId + '/activities/' + activity.id);
      batch.update(activityDoc, { initiative: initiativeId ?? '' });
    });
    await batch.commit(); // up to 500 operations

    //  update the initiative counters
    if (initiativeId) {
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
    const activityRows: ActivityRow[] = [];
    fetchedActivities.activities.forEach((activity: Activity) => {
      let priority = activity.priority;
      if ((priority == null || priority === -1) && activity.metadata) {
        priority = inferPriority(loaderData.tickets, activity.metadata);
      }
      let mapping;
      if (!activity.initiativeId || activity.launchItemId == null) {
        mapping = mapActivity(activity);
      }
      const { initiativeId, ...activityFields } = activity;
      activityRows.push({
        ...activityFields,
        actorId:
          activity.actorId ?
            loaderData.accountMap[activity.actorId] ?? activity.actorId // resolve identity
          : undefined,
        priority,
        initiative: { value: initiativeId || mapping?.initiatives[0] || '' },
        // activity.launchItemId is '', not null, if user explicitly unset it (perhaps because they didn't like the mapping)
        launchItemId:
          activity.launchItemId != null ? activity.launchItemId : mapping?.launchItems[0] ?? '',
      });
    });
    setActivities(activityRows);
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

  const initiativeOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '[unset]' },
      ...Object.keys(loaderData.initiatives).map(initiativeId => {
        const initiative = loaderData.initiatives[initiativeId];
        return {
          value: initiativeId,
          label: `[${initiative.key}] ${initiative.label}`,
        };
      }),
    ],
    [loaderData.initiatives]
  );

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({ field: 'timestamp', valueGetter: value => new Date(value) }),
      actorColDef(
        {
          field: 'actor',
          valueGetter: (_, row) => {
            const fields = row as Activity;
            return fields.actorId ?
                ({
                  id: fields.actorId,
                  name: loaderData.actors[fields.actorId]?.name ?? 'unknown',
                } as Account)
              : null;
          },
          renderCell: params => {
            const account = params.value as Account;
            return account ?
                <Link
                  tabIndex={params.tabIndex}
                  fontSize="small"
                  href={`/activity/${encodeURI(account.id)}`}
                  title="View activity"
                  sx={internalLinkSx}
                >
                  {account.name}
                </Link>
              : null;
          },
        },
        true /* show link */
      ),
      actionColDef({ field: 'action' }),
      descriptionColDef({ field: 'metadata' }, (element, content) =>
        setPopover({ element, content })
      ),
      priorityColDef({ field: 'priority' }),
      {
        field: 'launchItemId',
        headerName: 'Launch',
        valueGetter: (value: string) => loaderData.launchItems[value]?.key,
        getSortComparator: sortComparatorKeepingNullAtTheBottom,
        renderCell: (params: GridRenderCellParams) => {
          const activity = params.row as Activity;
          return activity.launchItemId ?
              <Box
                title={loaderData.launchItems[activity.launchItemId]?.label}
                color={loaderData.launchItems[activity.launchItemId]?.color ?? undefined}
              >
                {params.value}
              </Box>
            : null;
        },
      },
      {
        field: 'initiative',
        headerName: 'Goal',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: initiativeOptions,
        editable: true,
        sortable: false,
        renderCell: params => {
          const option = params.value as SelectOption;
          return (
            <Box>
              <Button
                tabIndex={params.tabIndex}
                color="inherit"
                endIcon={<ArrowDropDownIcon />}
                sx={{ ml: -1, fontWeight: '400', textTransform: 'none' }}
              >
                {option.value ? loaderData.initiatives[option.value]?.key ?? 'unknown' : '⋯'}
              </Button>
            </Box>
          );
        },
        renderEditCell: params => <AutocompleteSelect {...params} options={initiativeOptions} />,
      },
      {
        field: 'note',
        headerName: 'Note',
        width: 150,
        editable: true,
        sortable: false,
        renderCell: params => (
          <Box
            tabIndex={params.tabIndex}
            fontSize="small"
            color={theme.palette.primary.main}
            title={params.value as string}
            sx={{ ...ellipsisSx, cursor: 'pointer' }}
          >
            {params.value || '⋯'}
          </Box>
        ),
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ],
    [initiativeOptions, loaderData.actors, loaderData.initiatives, loaderData.launchItems]
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
                    {`[${loaderData.initiatives[initiativeId].key}] ${loaderData.initiatives[initiativeId].label}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid display="flex">
            <Button
              disabled={!bulkInitiative || rowSelectionModel.length > MAX_BATCH}
              onClick={() => {
                setRowSelectionModel([]);
                if (!activities) {
                  return;
                }
                activities
                  .filter(a => rowSelectionModel.includes(a.id))
                  .forEach(activity => (activity.initiative.value = bulkInitiative));
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
        options={{ linkifyActivityId: true }}
      />
      <BoxPopover popover={popover} onClose={() => setPopover(null)} />
      <Stack m={3}>
        <Grid container columns={2} spacing={2} alignItems="center" mb={1}>
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
            if (updatedRow.initiative.value !== oldRow.initiative.value) {
              assignInitiativeFetcher.submit(
                {
                  initiativeId: updatedRow.initiative.value,
                  initiativeCountersLastUpdated:
                    loaderData.initiatives[updatedRow.initiative.value]?.countersLastUpdated ??
                    null,
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
