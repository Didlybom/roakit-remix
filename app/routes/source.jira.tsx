import DataObjectIcon from '@mui/icons-material/DataObject';
import { Alert, Box, Link, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import { useEffect, useMemo, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import App from '../components/App';
import CodePopover, { PopoverContent } from '../components/CodePopover';
import TabPanel from '../components/TabPanel';
import { firestore as firestoreClient } from '../firebase.client';
import { JiraEventType, JiraRow, jiraRows } from '../schemas/jiraFeed';
import { loadSession } from '../utils/authUtils.server';
import { actorColdDef, dataGridCommonProps, dateColdDef } from '../utils/dataGridUtils';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  dateFilterToStartDate,
  formatMonthDay,
} from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { ellipsisSx } from '../utils/jsxUtils';

enum View {
  IssueCreated = 0,
  CommentCreated = 1,
}

export const meta = () => [{ title: 'Live Jira Activity | ROAKIT' }];

// verify JWT and get session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return sessionData;
};

export default function Jira() {
  const sessionData = useLoaderData<typeof loader>();
  const [view, setView] = useState<View>(View.IssueCreated);
  const isHydrated = useHydrated();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const prevDateFilter = usePrevious(dateFilter);
  const [popover, setPopover] = useState<PopoverContent | null>(null);
  const [error, setError] = useState('');

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const [jiraIssuesCreated, setJiraIssuesCreated] = useState<JiraRow[]>([]);
  const [jiraCommentsCreated, setJiraCommentsCreated] = useState<JiraRow[]>([]);

  const jiraColumns = useMemo<GridColDef[]>(
    () => [
      dateColdDef({ field: 'date' }),
      actorColdDef({ field: 'actor', headerName: 'Author', width: 120 }),
      {
        field: 'project',
        headerName: 'Project',
        width: 160,
        sortComparator: (a: JiraRow['project'], b: JiraRow['project']) =>
          (a?.key ?? '').localeCompare(b?.key ?? ''),
        valueFormatter: value => (value as JiraRow['project'])?.name ?? '',
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 100,
        sortComparator: (a: JiraRow['priority'], b: JiraRow['priority']) =>
          (b?.id ?? 999) - (a?.id ?? 999),
        valueFormatter: value => (value as JiraRow['priority'])?.name ?? '',
      },
      {
        field: 'ref',
        headerName: 'Ref.',
        width: 90,
        sortComparator: (a: JiraRow['ref'], b: JiraRow['ref']) =>
          (a?.label ?? '').localeCompare(b?.label ?? ''),
        renderCell: params => {
          const fields = params.value as JiraRow['ref'];
          return !fields ? '' : (
              <Link
                href={`${fields.url.split('rest')[0]}browse/${fields.label}`}
                target="_blank"
                sx={{ ...ellipsisSx }}
              >
                {fields.label}
              </Link>
            );
        },
      },
      {
        field: 'activity',
        headerName: 'Activity',
        minWidth: 300,
        flex: 1,
        sortComparator: (a: JiraRow['activity'], b: JiraRow['activity']) =>
          (a?.title ?? '').localeCompare(b?.title ?? ''),
        renderCell: params => {
          const fields = params.value as JiraRow['activity'];
          const title = fields?.title ?? '';
          let activity = '';
          if (fields) {
            if (fields.created) {
              activity += `Created ${formatMonthDay(new Date(fields.created))}, `;
            }
            if (fields.description) {
              activity += `${fields.description}, `;
            }
            if (fields.comment) {
              activity += `${fields.comment}, `;
            }
          }
          if (activity) {
            activity = activity.slice(0, -2);
          }
          return (
            <Stack sx={{ overflowX: 'scroll', mt: '5px' }}>
              <Typography variant="body2">{title}</Typography>
              <Tooltip title={activity}>
                <Typography variant="caption">{activity}</Typography>
              </Tooltip>
            </Stack>
          );
        },
      },
      {
        field: 'actions',
        type: 'actions',
        width: 50,
        cellClassName: 'actions',
        getActions: params => {
          const row = params.row as JiraRow;
          return [
            <GridActionsCellItem
              key={1}
              icon={<DataObjectIcon />}
              label="View source"
              onClick={e =>
                setPopover({
                  element: e.currentTarget,
                  content: row.sourceData,
                })
              }
            />,
          ];
        },
      },
    ],
    []
  );

  const setRows = (type: JiraEventType, querySnapshot: firebase.firestore.QuerySnapshot) => {
    try {
      switch (type) {
        case JiraEventType.IssueCreated:
          setJiraIssuesCreated(jiraRows(querySnapshot));
          break;
        case JiraEventType.CommentCreated:
          setJiraCommentsCreated(jiraRows(querySnapshot));
          break;
      }
      setGotSnapshot(true);
    } catch (e: unknown) {
      setError(errMsg(e, `Error parsing Jira ${type} events`));
    }
  };

  // Firestore listeners
  useEffect(() => {
    if (!dateFilter) {
      return;
    }
    setError('');
    setGotSnapshot(false);
    const unsubscribe: Record<string, () => void> = {};
    Object.values(JiraEventType).map((type: JiraEventType) => {
      const startDate = dateFilterToStartDate(dateFilter);
      const query = firestoreClient
        .collection(
          `customers/${sessionData.customerId}/feeds/2/events/${type}/instances` // FIXME feedId
        )
        .orderBy('eventTimestamp')
        .startAt(startDate)
        .limit(1000); // FIXME limit
      unsubscribe[type] = query.onSnapshot(
        snapshot => setRows(type, snapshot),
        error => setError(error.message)
      );
    });
    return () => Object.keys(unsubscribe).forEach(k => unsubscribe[k]());
  }, [dateFilter, sessionData.customerId]);

  return (
    <App
      view="jira"
      isLoggedIn={sessionData.isLoggedIn}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
    >
      <CodePopover popover={popover} onClose={() => setPopover(null)} />
      <Stack>
        {gotSnapshot && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 1 }}>
              <Tabs
                variant="scrollable"
                value={view}
                onChange={(e, newValue: View) => setView(newValue)}
              >
                <Tab label="Tickets Created" id={`tab-${View.IssueCreated}`} />
                <Tab label="Comments" id={`tab-${View.CommentCreated}`} />
              </Tabs>
            </Box>
            <TabPanel value={view} index={View.IssueCreated}>
              <DataGrid columns={jiraColumns} rows={jiraIssuesCreated} {...dataGridCommonProps} />
            </TabPanel>
            <TabPanel value={view} index={View.CommentCreated}>
              <DataGrid columns={jiraColumns} rows={jiraCommentsCreated} {...dataGridCommonProps} />
            </TabPanel>
          </>
        )}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}