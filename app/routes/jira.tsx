import { Alert, Box, Link, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import { JiraEventType, JiraRow, jiraRows } from '~/schemas/jiraFeed';
import { loadSession } from '~/utils/authUtils.server';
import { dataGridCommonProps, ellipsisAttrs } from '~/utils/jsxUtils';
import Header from '../components/Header';
import TabPanel from '../components/TabPanel';
import { firestore as firestoreClient } from '../firebase.client';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  dateFilterToStartDate,
  formatMonthDay,
  formatMonthDayTime,
  formatRelative,
} from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';

enum View {
  IssueCreated = 0,
  CommentCreated = 1,
}

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return sessionData;
};

export default function Index() {
  const sessionData = useLoaderData<typeof loader>();
  const [view, setView] = useState<View>(View.IssueCreated);
  const isHydrated = useHydrated();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const [jiraIssuesCreated, setJiraIssuesCreated] = useState<JiraRow[]>([]);
  const [jiraCommentsCreated, setJiraCommentsCreated] = useState<JiraRow[]>([]);

  const prevDateFilter = usePrevious(dateFilter);

  const [error, setError] = useState('');

  const jiraColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'timestamp',
        headerName: 'Date',
        type: 'dateTime',
        width: 100,
        valueGetter: params => new Date(params.value as number),
        valueFormatter: params => formatRelative(params.value as Date),
        renderCell: params => (
          <Tooltip title={formatMonthDayTime(params.value as Date)}>
            <Box sx={{ ...ellipsisAttrs }}>{formatRelative(params.value as Date)}</Box>
          </Tooltip>
        ),
      },
      {
        field: 'author',
        headerName: 'Author',
        width: 120,
        sortComparator: (a: JiraRow['author'], b: JiraRow['author']) =>
          (a?.name ?? '').localeCompare(b?.name ?? ''),
        renderCell: params => {
          const fields = params.value as JiraRow['author'];
          return !fields ? '' : (
              <Box sx={{ ...ellipsisAttrs }} title={fields.name}>
                {fields.name}
              </Box>
            );
        },
      },
      {
        field: 'project',
        headerName: 'Project',
        width: 160,
        sortComparator: (a: JiraRow['project'], b: JiraRow['project']) =>
          (a?.key ?? '').localeCompare(b?.key ?? ''),
        valueFormatter: params => (params.value as JiraRow['project'])?.name ?? '',
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 100,
        sortComparator: (a: JiraRow['priority'], b: JiraRow['priority']) =>
          (b?.id ?? 999) - (a?.id ?? 999),
        valueFormatter: params => (params.value as JiraRow['priority'])?.name ?? '',
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
                sx={{ ...ellipsisAttrs }}
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
    ],
    []
  );

  const setRows = (type: JiraEventType, querySnapshot: firebase.firestore.QuerySnapshot) => {
    setGotSnapshot(true);
    try {
      switch (type) {
        case JiraEventType.IssueCreated:
          return setJiraIssuesCreated(jiraRows(querySnapshot));
        case JiraEventType.CommentCreated:
          return setJiraCommentsCreated(jiraRows(querySnapshot));
      }
    } catch (e: unknown) {
      setError(errMsg(e, `Error parsing Jira ${type} events`));
    }
  };

  // Firestore listeners
  useEffect(() => {
    if (!dateFilter) {
      return;
    }
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
    <>
      <Header
        isLoggedIn={sessionData.isLoggedIn}
        view="jira"
        dateRange={dateFilter}
        onDateRangeSelect={dateRange => setDateFilter(dateRange)}
        showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
      />
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
              <DataGrid
                columns={jiraColumns}
                rows={jiraIssuesCreated}
                {...dataGridCommonProps}
              ></DataGrid>
            </TabPanel>
            <TabPanel value={view} index={View.CommentCreated}>
              <DataGrid
                columns={jiraColumns}
                rows={jiraCommentsCreated}
                {...dataGridCommonProps}
              ></DataGrid>
            </TabPanel>
          </>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </>
  );
}
