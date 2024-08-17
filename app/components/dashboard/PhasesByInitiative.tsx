import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { GroupedActivities } from '../../processors/activityGrouper';
import type { InitiativeRecord } from '../../types/types';
import { pluralizeMemo } from '../../utils/stringUtils';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function PhasesByInitiatives({
  groupedActivities,
  initiatives,
  dateRangeLabel,
  isLoading,
}: Props) {
  if (!initiatives || !groupedActivities?.initiatives?.length) {
    return null;
  }

  return groupedActivities.initiatives
    .filter(
      i =>
        i.phaseCount.design > 0 ||
        i.phaseCount.dev > 0 ||
        i.phaseCount.test > 0 ||
        i.phaseCount.deploy > 0 ||
        i.phaseCount.stabilize > 0 ||
        i.phaseCount.ops > 0
    )
    .map(initiative => {
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
                  data: ['Design', 'Code', 'Test', 'Deploy', 'Stabilize'],
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
