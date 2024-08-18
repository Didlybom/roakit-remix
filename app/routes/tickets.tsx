import {
  Close as CloseIcon,
  Edit as EditIcon,
  ManageSearch as ZoomInIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Unstable_Grid2 as Grid,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  type GridColDef,
  type GridRenderCellParams,
  type GridSortDirection,
} from '@mui/x-data-grid';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import App from '../components/App';
import { ClickableAvatar } from '../components/Avatars';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import HelperText from '../components/HelperText';
import SearchField from '../components/SearchField';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import {
  dataGridCommonProps,
  dateColDef,
  priorityColDef,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import { identifyAccounts } from '../processors/activityIdentifier';
import type { ActorRecord, Ticket, TicketPlanHistory } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { formatDayLocal } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import {
  desktopDisplaySx,
  ellipsisSx,
  errorAlert,
  getSearchParam,
  HEADER_HEIGHT,
  linkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
  verticalStickyBarSx,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { View } from '../utils/rbac';
import theme from '../utils/theme';
import type { TicketPlanHistoryResponse } from './fetcher.ticket.$ticketkey.plan-history';
import type { TicketsResponse } from './fetcher.tickets';

export const meta = () => [{ title: 'Tickets | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Tickets;

const SEARCH_PARAM_QUERY = 'q';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      initiatives,
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
  comment: string;
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

  const { id: identityId } = await queryIdentity(sessionData.customerId!, {
    email: sessionData.email,
  });
  if (!identityId) {
    throw Error('Identity required');
  }

  try {
    const plannedHours = actionRequest.plannedHours != null ? +actionRequest.plannedHours : null;
    const comment = actionRequest.comment;
    await Promise.all([
      firestore
        .doc(`customers/${sessionData.customerId!}/tickets/${actionRequest.key}`)
        .set({ plannedHours }, { merge: true }),
      firestore
        .collection(
          `customers/${sessionData.customerId!}/tickets/${actionRequest.key}/planHistory/`
        )
        .add({ identityId, timestamp: Date.now(), plannedHours, comment }),
    ]);
    return { status: { code: 'saved', message: 'Ticket saved' } };
  } catch (e) {
    return { error: errMsg(e, 'Failed to save ticket') };
  }
};

function SpentHours({ effort, actorMap }: { effort: Ticket['effort']; actorMap: ActorRecord }) {
  if (!effort) return null;
  return (
    <Stack fontSize="small" mt={2}>
      {Object.entries(effort)
        .filter(([, actors]) => actors)
        .sort(([date1], [date2]) => +date2 - +date1)
        .map(([date, actors], i) => (
          <Box key={i}>
            <Box fontWeight={600}>{formatDayLocal(date)}</Box>
            <Table size="small" sx={{ width: 300, mb: 2 }}>
              <TableBody>
                {Object.entries(actors!)
                  .sort(([, hours1], [, hours2]) => (hours2 ?? 0) - (hours1 ?? 0))
                  .map(([actorId, hours], i) => {
                    const actorName = actorMap[actorId]?.name;
                    return (
                      <TableRow key={i} sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell sx={{ maxWidth: 150 }}>
                          <Stack direction="row" spacing="4px" alignItems="center">
                            <ClickableAvatar name={actorName} size={18} fontSize={10} />
                            <Box title={actorName} sx={ellipsisSx}>
                              {actorName}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{hours}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Box>
        ))}
    </Stack>
  );
}

function PlannedHours({
  ticketKey,
  actorMap,
  cache,
  cacheAdd,
}: {
  ticketKey: string;
  actorMap: ActorRecord;
  cache: TicketPlanHistory[];
  cacheAdd: (planHistory: TicketPlanHistory) => void;
}) {
  const navigate = useNavigate();
  const ticketPlanHistoryFetcher = useFetcher<TicketPlanHistoryResponse>();
  const fetchedTicketPlanHistory = ticketPlanHistoryFetcher.data;
  const [ticketPlanHistory, setTicketPlanHistory] = useState<
    TicketPlanHistory['planHistory'] | undefined
  >(cache.find(p => p.ticketKey === ticketKey)?.planHistory);

  useEffect(() => {
    if (!ticketPlanHistory) {
      ticketPlanHistoryFetcher.load(`/fetcher/ticket/${ticketKey}/plan-history`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketKey, ticketPlanHistory]); // ticketPlanHistoryFetcher must be omitted

  useEffect(() => {
    const fetchedTicketKey = fetchedTicketPlanHistory?.planHistory?.ticketKey;
    if (fetchedTicketKey && fetchedTicketPlanHistory?.planHistory?.planHistory) {
      setTicketPlanHistory(fetchedTicketPlanHistory.planHistory.planHistory);
      cacheAdd(fetchedTicketPlanHistory.planHistory);
    }
  }, [cacheAdd, fetchedTicketPlanHistory?.planHistory]);

  useEffect(() => {
    if (fetchedTicketPlanHistory?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedTicketPlanHistory?.error, navigate]);

  if (!ticketPlanHistory) {
    return (
      <Box display="flex" justifyContent="center" width={400} mx={10} my={6}>
        <CircularProgress size={30} />
      </Box>
    );
  }
  return (
    <Table size="small" sx={{ width: 400, my: 2 }}>
      {ticketPlanHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((plan, i) => {
          const actorName = actorMap[plan.identityId]?.name;
          return (
            <>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={3}>{formatDayLocal(plan.timestamp)}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow key={i} sx={{ verticalAlign: 'top', '&:last-child td': { border: 0 } }}>
                  <TableCell>{plan.comment}</TableCell>
                  <TableCell sx={{ maxWidth: 120 }}>
                    <Stack direction="row" spacing="4px" alignItems="center">
                      <ClickableAvatar name={actorName} size={18} fontSize={10} />
                      <Box title={actorName} sx={ellipsisSx}>
                        {actorName}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{plan.plannedHours}</TableCell>
                </TableRow>
              </TableBody>
            </>
          );
        })}
    </Table>
  );
}

export default function Tickets() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const ticketsFetcher = useFetcher<TicketsResponse>();
  const fetchedTickets = ticketsFetcher.data;
  const [tickets, setTickets] = useState<Map<string | null, Ticket[]>>(new Map());
  const ticketPlanHistoryCache = useRef<TicketPlanHistory[]>([]);
  const [scrollToGroup, setScrollToGroup] = useState<string | null | undefined>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get(SEARCH_PARAM_QUERY) ?? '');
  const [showDialogForTicket, setShowDialogForTicket] = useState<Ticket['key'] | null>(null);
  const [updatingPlannedHours, setUpdatingPlannedHours] = useState<{
    hours?: number;
    comment?: string;
  } | null>(null);

  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);

  const [confirmation, setConfirmation] = useState('');
  const [error] = useState('');

  const initiativeElementId = (key: string) => `INITIATIVE-${key}`;

  // load tickets
  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
    }
    ticketsFetcher.load(`/fetcher/tickets`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData?.status]); // reload when a ticket has been updated

  useEffect(() => {
    if (fetchedTickets?.tickets) {
      const tickets = fetchedTickets.tickets.map(t => {
        if (t.effort == null) return t;
        const allActorHours = Object.values(t.effort)
          .map(actors => {
            if (!actors) return null;
            const actorHours = Object.values(actors).filter(h => h != null);
            if (actorHours.length === 0) return null;
            return actorHours.reduce((totalHours, hours) => totalHours + hours, 0);
          })
          .filter(h => h != null);
        if (allActorHours.length === 0) return t;
        return {
          ...t,
          spentHours: allActorHours.reduce((totalHours, hours) => totalHours + hours, 0),
        };
      });
      const groupedTickets = groupByArray(tickets, 'initiativeId');
      setTickets(
        sortMap(groupedTickets, (a, b) => {
          if (!a.key) return 1;
          if (!b.key) return -1;
          return b.values.length - a.values.length;
        })
      );
    }
  }, [fetchedTickets?.tickets]);

  useEffect(() => {
    if (fetchedTickets?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedTickets?.error, navigate]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToGroup != null) {
      const element = document.getElementById(initiativeElementId(scrollToGroup));
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
      {
        field: 'key',
        headerName: 'Key',
        renderCell: (params: GridRenderCellParams<Ticket, string>) =>
          loaderData.customerSettings?.ticketBaseUrl ?
            <Link
              tabIndex={params.tabIndex}
              fontSize="small"
              href={`${loaderData.customerSettings.ticketBaseUrl}${params.value}`}
              target="_blank"
              title="View ticket source"
              sx={linkSx}
            >
              {params.value}
            </Link>
          : params.value,
      },
      { field: 'summary', headerName: 'Summary', flex: 1 },
      priorityColDef({ field: 'priority' }),
      { field: 'status', headerName: 'Status' },
      {
        field: 'plannedHours',
        headerName: 'Planned hours',
        minWidth: 130,
        renderCell: (params: GridRenderCellParams<Ticket, number>) => {
          return (
            <Stack direction="row" display="flex" height="100%" alignItems="center">
              <Button
                tabIndex={params.tabIndex}
                size="small"
                endIcon={<EditIcon style={{ width: 12, height: 12 }} />}
                onClick={() => {
                  setUpdatingPlannedHours({ hours: params.row.plannedHours });
                  setShowDialogForTicket(params.row.key);
                }}
              >
                {params.value || '⋯'}
              </Button>
              {params.row.plannedHours != null && (
                <IconButton
                  onClick={e =>
                    setPopover?.({
                      element: e.currentTarget,
                      content: (
                        <PlannedHours
                          ticketKey={params.row.key}
                          cache={ticketPlanHistoryCache.current}
                          cacheAdd={ticketPlanHistory =>
                            ticketPlanHistoryCache.current.push(ticketPlanHistory)
                          }
                          actorMap={loaderData.actors!}
                        />
                      ),
                    })
                  }
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          );
        },
      },
      {
        field: 'spentHours',
        headerName: 'Spent hours',
        minWidth: 130,
        renderCell: (params: GridRenderCellParams<Ticket, number>) => (
          <Stack direction="row" display="flex" height="100%" spacing={1} alignItems="center">
            <Box>{params.value}</Box>
            {params.value && params.row.effort && (
              <IconButton
                onClick={e =>
                  setPopover?.({
                    element: e.currentTarget,
                    content: (
                      <SpentHours effort={params.row.effort!} actorMap={loaderData.actors!} />
                    ),
                  })
                }
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        ),
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaderData.actors, loaderData.customerSettings?.ticketBaseUrl] // ticketPlanHistoryFetcher must be omitted
  );

  const initiativeList = useMemo(
    () =>
      [...tickets.keys()].map((initiativeId, i) => {
        let label;
        if (!initiativeId) {
          label = 'No initiative';
        } else {
          label = loaderData.initiatives[initiativeId]?.label || 'Unknown initiative';
        }
        return (
          <Box
            key={i}
            mt={initiativeId ? undefined : 2}
            color={initiativeId ? undefined : theme.palette.grey[500]}
          >
            <Link
              sx={{
                ...linkSx,
                '&:hover': {
                  color:
                    initiativeId ?
                      loaderData.initiatives[initiativeId]?.color || undefined
                    : undefined,
                },
              }}
              color={initiativeId ? undefined : theme.palette.grey[500]}
              onClick={() => setScrollToGroup(initiativeId)}
            >
              {label}
            </Link>
          </Box>
        );
      }),
    [loaderData.initiatives, tickets]
  );

  const navBar = (
    <Box mr={3} sx={desktopDisplaySx}>
      <Box sx={{ position: 'relative' }}>
        <Box fontSize="small" color={theme.palette.grey[700]} sx={verticalStickyBarSx}>
          {initiativeList}
        </Box>
      </Box>
    </Box>
  );

  const filterBar = (
    <Grid container spacing={2} alignItems="center" mb={1}>
      <Grid>
        <HelperText infoIcon>
          You can use this page to fill out <b>planned hours</b>.
        </HelperText>
      </Grid>
      <Grid flex={1} />
      <Grid>
        <Grid container spacing={3}>
          <Grid>
            <SearchField
              title="Search tickets"
              value={searchTerm}
              setValue={q => {
                setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_QUERY, q));
                setSearchTerm(q);
              }}
              sx={{ width: { xs: '11ch', sm: '12ch' }, minWidth: { xs: '100px', sm: '160px' } }}
            />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );

  const handleSubmitPlannedHours = useCallback(
    (ticketKey: string) => {
      setShowDialogForTicket(null);
      ticketPlanHistoryCache.current = ticketPlanHistoryCache.current.filter(
        p => p.ticketKey !== ticketKey
      );
      submit(
        {
          key: ticketKey,
          plannedHours: updatingPlannedHours?.hours ?? null,
          comment: updatingPlannedHours?.comment ?? null,
        },
        postJsonOptions
      );
    },
    [submit, updatingPlannedHours]
  );

  const plannedHoursDialog = (
    <Dialog
      open={!!showDialogForTicket}
      onClose={() => setShowDialogForTicket(null)}
      fullWidth
      disableRestoreFocus
      PaperProps={{
        component: 'form',
        onSubmit: (e: FormEvent) => {
          e.preventDefault();
          handleSubmitPlannedHours(showDialogForTicket!);
        },
      }}
    >
      <DialogTitle>{showDialogForTicket}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} my={1}>
          <TextField
            autoComplete="off"
            label="Planned hours"
            type="number"
            size="small"
            required
            sx={{ maxWidth: 160 }}
            value={updatingPlannedHours?.hours}
            onChange={e =>
              setUpdatingPlannedHours({ ...updatingPlannedHours, hours: +e.target.value })
            }
          />
          <TextField
            autoComplete="off"
            label="Comment"
            size="small"
            fullWidth
            required
            value={updatingPlannedHours?.comment}
            onChange={e =>
              setUpdatingPlannedHours({ ...updatingPlannedHours, comment: e.target.value })
            }
          />
        </Stack>
        <IconButton
          onClick={() => setShowDialogForTicket(null)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogActions sx={{ mt: 2 }}>
          <Button
            variant="contained"
            sx={{ borderRadius: 28, textTransform: 'none' }}
            disabled={
              !updatingPlannedHours || !updatingPlannedHours.hours || !updatingPlannedHours.comment
            }
            type="submit"
          >
            Save
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );

  const grids = useMemo(() => {
    return [...tickets].map(([initiativeId, rows], i) => {
      let initiativeKey;
      let initiativeLabel;
      if (!initiativeId) {
        initiativeKey = '';
        initiativeLabel = 'No initiative';
      } else {
        initiativeKey = loaderData.initiatives[initiativeId]?.key ?? '';
        initiativeLabel = loaderData.initiatives[initiativeId]?.label ?? 'Unknown initiative';
      }
      const search = searchTerm.trim().toLowerCase();
      const filteredRows =
        searchTerm ?
          rows.filter(ticket => {
            if (ticket.key.toLowerCase().indexOf(search) >= 0) return true;
            if (ticket.summary && ticket.summary.toLowerCase().indexOf(search) >= 0) {
              return true;
            }
            return false;
          })
        : rows;
      return !filteredRows?.length || initiativeId == null ?
          null
        : <Stack id={initiativeElementId(initiativeId)} key={i} sx={{ mb: 3 }}>
            <Stack
              direction="row"
              spacing={1}
              divider={<Divider orientation="vertical" flexItem />}
              color={theme.palette.grey[initiativeId ? 600 : 400]}
              mb={1}
              sx={{ textWrap: 'nowrap' }}
            >
              {initiativeKey && (
                <Typography
                  variant="h6"
                  fontSize="1.1rem"
                  fontWeight={600}
                  color={loaderData.initiatives[initiativeId]?.color || undefined}
                >
                  {initiativeKey}
                </Typography>
              )}
              <Typography variant="h6" fontSize="1.1rem">
                {initiativeLabel}
              </Typography>
            </Stack>
            <DataGridWithSingleClickEditing
              columns={columns}
              rows={filteredRows}
              getRowId={row => row.key}
              {...dataGridCommonProps}
              rowHeight={50}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: {
                  sortModel: [{ field: 'lastUpdatedTimestamp', sort: 'desc' as GridSortDirection }],
                },
              }}
            />
          </Stack>;
    });
  }, [tickets, searchTerm, loaderData.initiatives, columns]);

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
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{
          linkifyTicketKey: loaderData.email?.endsWith('@roakit.com'),
        }}
      />
      <BoxPopover popover={popover} onClose={() => setPopover(null)} showClose={true} />
      {showDialogForTicket && plannedHoursDialog}
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
