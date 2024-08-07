import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { GroupedLaunchStats } from '../../processors/initiativeGrouper';
import type { InitiativeRecord } from '../../types/types';
import { pluralizeMemo } from '../../utils/stringUtils';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  stats: GroupedLaunchStats;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function TicketsByInitiative({
  stats,
  initiatives,
  dateRangeLabel,
  isLoading,
}: Props) {
  if (!initiatives || !stats.launches) {
    return null;
  }
  return Object.keys(stats.launches).map(initiativeId => {
    const initiative = stats.launches![initiativeId];
    return (
      <Grid key={initiativeId}>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle(initiatives[initiativeId]?.label ?? 'Unknown')}
          <BarChart
            series={[
              {
                id: `${initiativeId} tickets`,
                data: [
                  initiative.new,
                  initiative.ongoing,
                  initiative.blocked,
                  initiative.completed,
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('ticket', value ?? 0)}`,
                label: dateRangeLabel,
                stack: 'stack',
                color: initiatives[initiativeId]?.color || undefined,
              },
            ]}
            xAxis={[
              {
                data: ['New', 'In progress', 'Blocked', 'Completed'],
                scaleType: 'band',
                tickLabelStyle: { angle: -45, textAnchor: 'end' },
                tickMinStep: 1,
                tickMaxStep: 1,
              },
            ]}
            yAxis={[{ tickMinStep: 1 }]}
            {...widgetSize}
            margin={{ bottom: 60 }}
            slotProps={{ legend: { hidden: true } }}
            colors={pastelColors}
          />
        </Paper>
      </Grid>
    );
  });
}
