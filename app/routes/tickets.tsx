import {
  Box,
  Divider,
  Unstable_Grid2 as Grid,
  Link,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { type GridColDef, type GridSortDirection } from '@mui/x-data-grid';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import App from '../components/App';
import SearchField from '../components/SearchField';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import {
  dataGridCommonProps,
  dateColDef,
  StyledMuiError,
} from '../components/datagrid/dataGridCommon';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import { identifyAccounts } from '../processors/activityIdentifier';
import type { Ticket } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import {
  desktopDisplaySx,
  errorAlert,
  HEADER_HEIGHT,
  linkSx,
  loaderErrorResponse,
  verticalStickyBarSx,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { View } from '../utils/rbac';
import { removeSpaces } from '../utils/stringUtils';
import theme from '../utils/theme';
import type { TicketsResponse } from './fetcher.tickets';

export const meta = () => [{ title: 'Tickets | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Tickets;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const [launchItems, accounts, identities] = await Promise.all([
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      launchItems,
      actors,
      accountMap: identities.accountMap,
    };
  } catch (e) {
    getLogger('route:tickets').error(e);
    throw loaderErrorResponse(e);
  }
};

interface ActionRequest {
  key: string;
  plannedHours: number;
}

interface ActionResponse {
  status?: { code: 'saved'; message?: string };
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadSession(request, VIEW);
  const actionRequest = (await request.json()) as ActionRequest;

  if (!actionRequest.key) {
    return { error: 'Invalid ticket update request' };
  }
  try {
    await firestore
      .doc(`customers/${sessionData.customerId!}/tickets/${actionRequest.key}`)
      .set(
        { plannedHours: actionRequest.plannedHours != null ? +actionRequest.plannedHours : null },
        { merge: true }
      );

    return { status: { code: 'saved', message: 'Ticket saved' } };
  } catch (e) {
    return { error: errMsg(e, 'Failed to save ticket') };
  }
};

export default function LaunchItems() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const ticketsFetcher = useFetcher<TicketsResponse>();
  const fetchedTickets = ticketsFetcher.data;
  const [tickets, setTickets] = useState<Map<string | null, Ticket[]>>(new Map());
  const [scrollToGroup, setScrollToGroup] = useState<string | null | undefined>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchTerm] = useDebounce(searchFilter.trim().toLowerCase(), 50);

  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  const groupElementId = (id: string) => `GROUP-${id ? removeSpaces(id) : id}`;

  // load tickets
  useEffect(() => {
    ticketsFetcher.load(`/fetcher/tickets`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fetchedTickets?.tickets) {
      const tickets = fetchedTickets.tickets.map(t => ({
        ...t,
        spentHours:
          t.effort ?
            Object.values(t.effort)
              .map(actors =>
                actors ?
                  Object.values(actors).reduce(
                    (totalHours, hours) => (totalHours ?? 0) + (hours ?? 0),
                    0
                  )
                : null
              )
              .reduce((totalHours, hours) => (totalHours ?? 0) + (hours ?? 0))
          : null,
      }));
      const groupedTickets = groupByArray(tickets, 'launchItemId');
      setTickets(
        sortMap(groupedTickets, (a, b) => {
          if (!a.key) return 1;
          if (!b.key) return -1;
          return b.values.length - a.values.length;
        })
      );
    }
  }, [fetchedTickets?.tickets]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToGroup != null) {
      const element = document.getElementById(groupElementId(scrollToGroup));
      setScrollToGroup(null);
      if (element) {
        setTimeout(
          () =>
            window.scrollTo({
              top: element.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 3,
              behavior: 'smooth',
            }),
          0
        );
      }
    }
  }, [scrollToGroup]);

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({
        field: 'lastUpdatedTimestamp',
        headerName: 'Last Updated',
        minWidth: 100,
        valueGetter: value => (value ? new Date(value) : value),
      }),
      { field: 'key', headerName: 'Key' },
      { field: 'summary', headerName: 'Summary', flex: 1 },
      { field: 'plannedHours', headerName: 'Planned Hours', editable: true },
      { field: 'spentHours', headerName: 'Spent Hours' },
    ],
    []
  );

  const launchList = useMemo(() => {
    const launchList = [...tickets.keys()].map((launchId, i) => {
      let label;
      if (!launchId) {
        label = 'No launch item';
      } else {
        label = loaderData.launchItems[launchId]?.label || 'Unknown launch item';
      }
      return (
        <Box
          key={i}
          mt={launchId ? undefined : 2}
          color={launchId ? undefined : theme.palette.grey[500]}
        >
          <Link
            sx={{
              ...linkSx,
              '&:hover': {
                color: launchId ? loaderData.launchItems[launchId]?.color || undefined : undefined,
              },
            }}
            color={launchId ? undefined : theme.palette.grey[500]}
            onClick={() => setScrollToGroup(launchId)}
          >
            {label}
          </Link>
        </Box>
      );
    });
    return launchList;
  }, [loaderData.launchItems, tickets]);

  const navBar = (
    <Box mr={2} sx={desktopDisplaySx}>
      <Box sx={{ position: 'relative' }}>
        <Box fontSize="small" color={theme.palette.grey[700]} sx={verticalStickyBarSx}>
          {launchList}
        </Box>
      </Box>
    </Box>
  );

  const filterBar = (
    <Grid container spacing={2} alignItems="center">
      <Grid flex={1} />
      <Grid>
        <Grid container spacing={3}>
          <Grid>
            <SearchField
              title="Search tickets"
              value={searchFilter}
              setValue={setSearchFilter}
              sx={{ width: { xs: '11ch', sm: '12ch' }, minWidth: { xs: '100px', sm: '160px' } }}
            />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );

  const grids = useMemo(() => {
    return [...tickets].map(([launchId, rows], i) => {
      let launchKey;
      let launchLabel;
      if (!launchId) {
        launchKey = '';
        launchLabel = 'No launch item';
      } else {
        launchKey = loaderData.launchItems[launchId]?.key ?? '';
        launchLabel = loaderData.launchItems[launchId]?.label ?? 'Unknown launch item';
      }
      const filteredRows =
        searchTerm ?
          rows.filter(ticket => {
            if (ticket.key.toLowerCase().indexOf(searchTerm) >= 0) return true;
            if (ticket.summary && ticket.summary.toLowerCase().indexOf(searchTerm) >= 0) {
              return true;
            }
            return false;
          })
        : rows;
      return !filteredRows?.length || launchId == null ?
          null
        : <Stack id={groupElementId(launchId)} key={i} sx={{ mb: 3 }}>
            <Stack
              direction="row"
              spacing={1}
              divider={<Divider orientation="vertical" flexItem />}
              color={theme.palette.grey[launchId ? 600 : 400]}
              mb={1}
              sx={{ textWrap: 'nowrap' }}
            >
              {launchKey && (
                <Typography
                  variant="h6"
                  fontSize="1.1rem"
                  fontWeight={600}
                  color={loaderData.launchItems[launchId]?.color || undefined}
                >
                  {launchKey}
                </Typography>
              )}
              <Typography variant="h6" fontSize="1.1rem">
                {launchLabel}
              </Typography>
            </Stack>
            <StyledMuiError>
              <DataGridWithSingleClickEditing
                columns={columns}
                rows={filteredRows}
                getRowId={row => row.key}
                {...dataGridCommonProps}
                rowHeight={50}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                  sorting: {
                    sortModel: [
                      { field: 'lastUpdatedTimestamp', sort: 'desc' as GridSortDirection },
                    ],
                  },
                }}
                processRowUpdate={(updatedRow: Ticket, oldRow: Ticket) => {
                  if (updatedRow.plannedHours !== oldRow.plannedHours) {
                    submit(
                      {
                        key: updatedRow.key,
                        plannedHours: updatedRow.plannedHours ?? null,
                      },
                      postJsonOptions
                    );
                  }
                  return updatedRow;
                }}
                onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save ticket'))}
              />
            </StyledMuiError>
          </Stack>;
    });
  }, [tickets, searchTerm, loaderData.launchItems, columns, submit]);

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
      <Stack m={3} direction="row">
        {navBar}
        <Stack flex={1} minWidth={0}>
          {filterBar}
          {grids}
        </Stack>
      </Stack>
    </App>
  );
}
