import {
  Alert,
  Box,
  Button,
  FormControl,
  Unstable_Grid2 as Grid,
  InputLabel,
  Link,
  MenuItem,
  Popover,
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
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import { usePrevious } from '@uidotdev/usehooks';
import {
  QueryDocumentSnapshot,
  collection,
  endBefore,
  getCountFromServer,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
} from 'firebase/firestore';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import DataGridWithSingleClickEditing from '../components/DataGridWithSingleClickEditing';
import FilterMenu from '../components/FilterMenu';
import { firestore as firestoreClient } from '../firebase.client';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchTicketPriorityMap,
} from '../firestore.server/fetchers.server';
import { incrementInitiativeCounters } from '../firestore.server/updaters.server';
import { identifyAccounts, inferPriority } from '../schemas/activityFeed';
import {
  AccountData,
  ActivityCount,
  ActivityData,
  ActivityMetadata,
  Artifact,
  activitySchema,
} from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import {
  actionColDef,
  actorColdDef,
  dateColdDef,
  metadataActionsColDef,
  priorityColDef,
  summaryColDef,
} from '../utils/dataGridUtils';
import { ParseError, errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { internalLinkSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:activity' });

const MAX_BATCH = 500;
const UNSET_INITIATIVE_ID = '_UNSET_INITIATIVE_';
const DELETE = '_DELETE_';

export const meta = () => [{ title: 'Activity | ROAKIT' }];

// verify JWT, load initiatives and users
export const loader = async ({ request }: LoaderFunctionArgs) => {
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
      fetchTicketPriorityMap(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      initiatives,
      actors,
      accountMap: identities.accountMap,
      tickets,
    };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

type ActivityRow = ActivityData & { note?: string };
type ActivityPayload = { id: string; artifact: Artifact; createdTimestamp: number }[];

interface JsonRequest {
  activityId?: string;
  activities?: ActivityPayload;
  initiativeId?: string;
  initiativeCountersLastUpdated?: number;
  note?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

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
    const counters: ActivityCount = { code: 0, codeOrg: 0, task: 0, taskOrg: 0 };
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
    throw e;
  }
};

type ShowActivity = '' | 'withInitiative' | 'withoutInitiative';

export default function ActivityReview() {
  const fetcher = useFetcher();
  const sessionData = useLoaderData<typeof loader>();
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [activityFilter, setActivityFilter] = useState<ShowActivity>('');
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);
  const [bulkInitiative, setBulkInitiative] = useState('');
  const [rowTotal, setRowTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const prevPaginationModel = usePrevious(paginationModel);
  const [boundaryDocs, setBoundaryDocs] = useState<{
    first: QueryDocumentSnapshot;
    last: QueryDocumentSnapshot;
  } | null>(null);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      setError('');
      try {
        const activitiesCollection = collection(
          firestoreClient,
          `customers/${sessionData.customerId}/activities`
        );
        const activityQuery =
          activityFilter === '' ?
            query(activitiesCollection)
          : query(
              activitiesCollection,
              where('initiative', activityFilter === 'withInitiative' ? '!=' : '==', '')
            );
        let activityPageQuery = activityQuery;
        if (prevPaginationModel && boundaryDocs) {
          if (prevPaginationModel?.page < paginationModel.page) {
            activityPageQuery = query(
              activityQuery,
              orderBy('createdTimestamp', 'desc'),
              startAfter(boundaryDocs.last),
              limit(paginationModel.pageSize)
            );
          } else if (prevPaginationModel?.page > paginationModel.page) {
            activityPageQuery = query(
              activityQuery,
              orderBy('createdTimestamp', 'desc'),
              endBefore(boundaryDocs.first),
              limitToLast(paginationModel.pageSize)
            );
          } else {
            // reachable on dev hot reload, then page is the same but we are reloading
            activityPageQuery = query(
              activityQuery,
              orderBy('createdTimestamp', 'desc'),
              startAt(boundaryDocs.first),
              limit(paginationModel.pageSize)
            );
          }
        } else {
          activityPageQuery = query(
            activityQuery,
            orderBy('createdTimestamp', 'desc'),
            limit(paginationModel.pageSize)
          );
        }
        const [activityDocs, activityCount] = await Promise.all([
          getDocs(activityPageQuery),
          getCountFromServer(activityQuery),
        ]);
        const activityData: ActivityData[] = [];
        activityDocs.forEach(activity => {
          const fields = activitySchema.safeParse(activity.data());
          if (!fields.success) {
            throw new ParseError('Failed to parse activities. ' + fields.error.message);
          }
          let priority = fields.data.priority;
          if (priority === undefined || priority === -1) {
            priority = inferPriority(sessionData.tickets, fields.data.metadata as ActivityMetadata);
          }
          activityData.push({
            id: activity.id,
            action: fields.data.action,
            event: fields.data.event,
            actorId:
              fields.data.actorAccountId ?
                sessionData.accountMap[fields.data.actorAccountId] ?? fields.data.actorAccountId // resolve identity
              : undefined,
            artifact: fields.data.artifact,
            createdTimestamp: fields.data.createdTimestamp,
            priority,
            initiativeId: fields.data.initiative || UNSET_INITIATIVE_ID,
            metadata: fields.data.metadata as ActivityMetadata,
            note: fields.data.note,
            objectId: fields.data.objectId, // for debugging
          });
        });
        setActivities(activityData);
        setRowTotal(activityCount.data().count);
        if (activityDocs.docs.length > 0) {
          setBoundaryDocs({
            first: activityDocs.docs[0],
            last: activityDocs.docs[activityDocs.docs.length - 1],
          });
        }
        setLoading(false);
      } catch (e) {
        setError(errMsg(e, 'Failed to fetch activities'));
      }
    };

    void fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilter, paginationModel]); // sessionData, prevPaginationModel and boundaryDocs must be omitted

  const dataGridProps = {
    autosizeOnMount: true,
    autoHeight: true, // otherwise empty state looks ugly
    slots: {
      noRowsOverlay: () => (
        <Box height="75px" display="flex" alignItems="center" justifyContent="center">
          Nothing to show
        </Box>
      ),
    },
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
      dateColdDef({
        field: 'createdTimestamp',
        valueGetter: (value: number) => new Date(value),
      }),
      actorColdDef({
        field: 'actor',
        headerName: 'Contributor',
        valueGetter: (_, row) => {
          const fields = row as ActivityData;
          return fields.actorId ?
              ({
                id: fields.actorId,
                name: sessionData.actors[fields.actorId]?.name ?? 'unknown',
              } as AccountData)
            : '';
        },
        renderCell: params => {
          const fields = params.value as AccountData;
          return (
            <Link
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
      priorityColDef({ field: 'priority' }),
      summaryColDef({ field: 'metadata' }, (element, content) => setPopover({ element, content })),
      {
        field: 'initiativeId',
        headerName: 'Initiative',
        minWidth: 100,
        type: 'singleSelect',
        valueOptions: [
          { value: UNSET_INITIATIVE_ID, label: '[unset]' },
          ...Object.keys(sessionData.initiatives).map(initiativeId => {
            const initiative = sessionData.initiatives[initiativeId];
            return { value: initiativeId, label: `[${initiativeId}] ${initiative.label}` };
          }),
        ],
        editable: true,
        renderCell: params =>
          params.value !== UNSET_INITIATIVE_ID ?
            <Box sx={{ cursor: 'pointer' }}>
              {sessionData.initiatives[params.value as string]?.label ?? 'unknown'}
            </Box>
          : <Box sx={{ cursor: 'pointer' }}>{'...'}</Box>,
      },
      {
        field: 'note',
        headerName: 'Note',
        minWidth: 100,
        editable: true,
        sortable: false,
        renderCell: params => (
          <Box title={params.value as string} sx={{ cursor: 'pointer' }}>
            {params.value || '...'}
          </Box>
        ),
      },
      metadataActionsColDef({}, (element, metadata) =>
        setCodePopover({ element, content: metadata })
      ),
    ],
    [sessionData.actors, sessionData.initiatives]
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
              <InputLabel id="initiative">Add to initiative</InputLabel>
              <Select
                id="initiative-select"
                value={bulkInitiative}
                label="Select an initiative"
                onChange={e => setBulkInitiative(e.target.value)}
                sx={{ minWidth: '250px' }}
              >
                {Object.keys(sessionData.initiatives).map(initiativeId => (
                  <MenuItem key={initiativeId} value={initiativeId}>
                    {`[${initiativeId}] ${sessionData.initiatives[initiativeId].label}`}
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
                  .forEach(activity => {
                    activity.initiativeId = bulkInitiative;
                  });
                setActivities(activities);
                fetcher.submit(
                  {
                    initiativeId: bulkInitiative,
                    initiativeCountersLastUpdated:
                      sessionData.initiatives[bulkInitiative]?.countersLastUpdated,
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
        view="activity"
        isLoggedIn={true}
        isNavOpen={sessionData.isNavOpen}
        showProgress={true}
      />
    );
  }
  return (
    <App
      view="activity"
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      showProgress={loading}
      showPulse={false}
    >
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={sessionData.customerId}
        options={{ linkifyBuckets: true }}
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
        {error && (
          <Alert severity="error" variant="standard" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Grid container columns={2} spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid>
            {!!rowTotal && (
              <Typography variant="subtitle2">
                {rowTotal.toLocaleString()} {pluralize('activity', rowTotal)}
              </Typography>
            )}
          </Grid>
          <Grid flex={1}>
            <FilterMenu
              sx={{ justifyContent: 'right' }}
              selectedValue={activityFilter}
              items={[
                { value: '', label: 'None', color: grey[500] },
                { value: 'withoutInitiative', label: 'Without initiatives' },
                { value: 'withInitiative', label: 'With initiatives' },
              ]}
              onChange={e => {
                setPaginationModel({ ...paginationModel, page: 0 });
                setBoundaryDocs(null);
                setActivityFilter(e.target.value as ShowActivity);
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
              setBoundaryDocs(null);
            } else {
              setPaginationModel(newPaginationModel);
            }
          }}
          slots={{ toolbar: rowSelectionModel.length ? BulkToolbar : undefined }}
          processRowUpdate={(updatedRow: ActivityRow, oldRow: ActivityRow) => {
            if (updatedRow.initiativeId !== oldRow.initiativeId) {
              fetcher.submit(
                {
                  initiativeId: updatedRow.initiativeId,
                  initiativeCountersLastUpdated:
                    sessionData.initiatives[updatedRow.initiativeId]?.countersLastUpdated,
                  activities: [
                    {
                      id: updatedRow.id,
                      artifact: updatedRow.artifact,
                      createdTimestamp: updatedRow.createdTimestamp,
                    },
                  ] as ActivityPayload,
                },
                postJsonOptions
              );
            } else if (updatedRow.note !== oldRow.note) {
              fetcher.submit(
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
