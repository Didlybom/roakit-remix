import { Paper, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart, PieChart } from '@mui/x-charts';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import Header from '~/components/Header';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Dashboard() {
  const sessionData = useLoaderData<typeof loader>();

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
    <>
      <Header isLoggedIn={sessionData.isLoggedIn} view="info" />
      <Grid container justifyContent="center" spacing={5} sx={{ mt: 5 }}>
        <Grid>
          <Paper sx={{ ...commonPaperSx }}>
            <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
              Effort by Initiative
            </Typography>
            <PieChart
              series={[
                {
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
                { data: [20, 15, 5, 30], label: 'Total', stack: 'total' },
                { data: [3, 2, 0, 5], label: 'New', stack: 'total' },
              ]}
              xAxis={[
                {
                  data: ['Initiative A', 'Initiative B', 'Initiative C', 'Initiative D'],
                  scaleType: 'band',
                },
              ]}
              {...commonChartProps}
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
                { data: [20, 35, 10, 5], label: 'Total', stack: 'total' },
                { data: [3, 4, 0, 1], label: 'New', stack: 'total' },
              ]}
              xAxis={[
                {
                  data: ['Software', 'Task', 'Software Org.', 'Task Org.'],
                  scaleType: 'band',
                },
              ]}
              {...commonChartProps}
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
            />
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}
