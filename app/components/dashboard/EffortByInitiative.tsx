import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts';
import type { GroupedActivities } from '../../activityProcessors/activityGrouper';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  type: 'initiatives' | 'launchItems';
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  isLoading?: boolean;
};

export default function InitiativeEffort({
  type,
  groupedActivities,
  initiatives,
  isLoading,
}: Props) {
  return (
    !!initiatives &&
    !!groupedActivities?.[type]?.length && (
      <Grid>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle(type === 'initiatives' ? 'Effort by Goal' : 'Effort by Launch')}
          <PieChart
            series={[
              {
                id: `effort-by-${type}`,
                data: groupedActivities[type]
                  .filter(initiative => initiative.effort)
                  .map(initiative => ({
                    id: initiatives[initiative.id].key,
                    value: initiative.effort,
                    label: initiatives[initiative.id].label,
                    color: initiatives[initiative.id].color || undefined,
                  })),
                arcLabel: item => `${item.id}`,
                outerRadius: 100,
                innerRadius: 30,
              },
            ]}
            margin={{ left: 100 }}
            sx={{ [`& .${pieArcLabelClasses.root}`]: { fill: 'white', fontSize: 'small' } }}
            {...widgetSize}
            slotProps={{ legend: { hidden: true } }}
            colors={pastelColors}
          />
        </Paper>
      </Grid>
    )
  );
}
