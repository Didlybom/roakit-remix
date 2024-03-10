import { Paper, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart, BarItemIdentifier, PieChart, PieItemIdentifier } from '@mui/x-charts';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import App from '../components/App';
import { DATE_RANGE_LOCAL_STORAGE_KEY, DateRange } from '../utils/dateUtils';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Dashboard() {
  const sessionData = useLoaderData<typeof loader>();
  const isHydrated = useHydrated();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const prevDateFilter = usePrevious(dateFilter);

  const [clickedOn, setClickedOn] = useState<BarItemIdentifier | PieItemIdentifier | null>(null);

  const commonPaperSx = { width: 380, p: 1 };
  const commonChartProps = {
    width: 360,
    height: 200,
    slotProps: {
      legend: {
        labelStyle: {
          fontSize: 12,
        },
      },
    },
  };

  return (
    <App
      view="dashboard"
      isLoggedIn={sessionData.isLoggedIn}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateFilter => setDateFilter(dateFilter)}
      showProgress={false && prevDateFilter && dateFilter !== prevDateFilter}
    >
      <Typography textAlign="center" variant="h6" sx={{ m: 3 }}>
        Under construction
      </Typography>
      <Grid container justifyContent="center" spacing={5} sx={{ my: 5 }}>
        <Grid>
          <Paper sx={{ ...commonPaperSx }}>
            <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
              Effort by Initiative
            </Typography>
            <PieChart
              series={[
                {
                  id: 'effort-by-initiative',
                  valueFormatter: item => `${item.value}%`,
                  data: [
                    { id: 1, value: 70, label: 'Initiative B' },
                    { id: 2, value: 10, label: 'Initiative A' },
                    { id: 3, value: 5, label: 'Initiative D' },
                    { id: 4, value: 15, label: 'Initiative C' },
                  ],
                },
              ]}
              {...commonChartProps}
              onItemClick={(_, item: PieItemIdentifier) => setClickedOn(item)}
            />
          </Paper>
        </Grid>
        <Grid>
          <Paper sx={{ ...commonPaperSx }}>
            <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
              Contributors by Initiative
            </Typography>
            <BarChart
              series={[
                { id: 'actors total', data: [20, 15, 5, 30], label: 'Total', stack: 'total' },
                { id: 'actors new', data: [3, 2, 0, 5], label: 'New', stack: 'total' },
              ]}
              xAxis={[
                {
                  data: ['Initiative A', 'Initiative B', 'Initiative C', 'Initiative D'],
                  scaleType: 'band',
                },
              ]}
              {...commonChartProps}
              onItemClick={(_, item: BarItemIdentifier) => setClickedOn(item)}
            />
          </Paper>
        </Grid>
        <Grid>
          <Paper sx={{ ...commonPaperSx }}>
            <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
              Initiative A Activity
            </Typography>
            <BarChart
              series={[
                { id: 'init A total', data: [20, 35, 10, 5], label: 'Total', stack: 'total' },
                { id: 'init A new', data: [3, 4, 0, 1], label: 'New', stack: 'total' },
              ]}
              xAxis={[
                {
                  data: ['Software', 'Task', 'Software Org.', 'Task Org.'],
                  scaleType: 'band',
                },
              ]}
              {...commonChartProps}
              onItemClick={(_, item: BarItemIdentifier) => setClickedOn(item)}
            />
          </Paper>
        </Grid>
        <Grid>
          <Paper sx={{ ...commonPaperSx }}>
            <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
              Activity by Priority
            </Typography>
            <PieChart
              series={[
                {
                  id: 'activity-by-priority',
                  valueFormatter: item => `${item.value}%`,
                  data: [
                    { id: 1, value: 5, label: 'Highest', color: '#f26d50' },
                    { id: 2, value: 10, label: 'High', color: '#f17c37' },
                    { id: 3, value: 75, label: 'Medium', color: '#f2c43d' },
                    { id: 4, value: 10, label: 'Low', color: '#a7ecf2' },
                    { id: 5, value: 0, label: 'Lowest', color: '#3e9cbf' },
                  ],
                },
              ]}
              {...commonChartProps}
              onItemClick={(_, item: PieItemIdentifier) => setClickedOn(item)}
            />
          </Paper>
        </Grid>
      </Grid>
      <Typography textAlign="center">{!!clickedOn && JSON.stringify(clickedOn)}</Typography>
    </App>
  );
}
