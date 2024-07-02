import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { GroupedActivities } from '../../activityProcessors/activityGrouper';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pastelColors, pluralizeMemo, widgetSize, widgetTitle } from './common';

type Props = {
  type: 'initiatives' | 'launchItems';
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function PhasesByInitiatives({
  type,
  groupedActivities,
  initiatives,
  dateRangeLabel,
  isLoading,
}: Props) {
  if (!initiatives || !groupedActivities?.[type]?.length) {
    return null;
  }

  return groupedActivities[type].map(initiative => {
    return (
      <Grid key={initiative.id}>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle(initiatives[initiative.id]?.label ?? 'Unknown')}
          <BarChart
            series={[
              {
                id: `${initiative.id} phases`,
                data: [
                  initiative.phaseCount.design,
                  initiative.phaseCount.dev,
                  initiative.phaseCount.test,
                  initiative.phaseCount.deploy,
                  initiative.phaseCount.stabilize,
                  initiative.phaseCount.ops,
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                label: dateRangeLabel,
                color: initiatives[initiative.id]?.color || undefined,
              },
            ]}
            xAxis={[
              {
                data: ['Design', 'Code', 'Test', 'Deploy', 'Stabilize', 'Operate'],
                scaleType: 'band',
                tickLabelStyle: { angle: -45, textAnchor: 'end' },
                tickMinStep: 1,
                tickMaxStep: 1,
              },
            ]}
            yAxis={[{ tickMinStep: 1 }]}
            {...widgetSize}
            margin={{ bottom: 60 }}
            slotProps={{
              legend: {
                direction: 'row',
                position: { vertical: 'top', horizontal: 'middle' },
                itemMarkHeight: 10,
                itemGap: 20,
                padding: 0,
                labelStyle: { fontSize: 12 },
              },
            }}
            colors={pastelColors}
          />
        </Paper>
      </Grid>
    );
  });
}
