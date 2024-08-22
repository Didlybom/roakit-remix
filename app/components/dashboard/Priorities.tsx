import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { PieChart, type PieValueType } from '@mui/x-charts';
import type { GroupedActivities } from '../../processors/activityGrouper';
import { pluralizeMemo } from '../../utils/stringUtils';
import { priorityColors, priorityLabels } from '../../utils/theme';
import { commonPaperSx, widgetSize, widgetTitle } from './common';

const priorityDefs: Record<number, Omit<PieValueType, 'value'>> = {
  1: { id: 1, label: priorityLabels[1], color: priorityColors[1] },
  2: { id: 2, label: priorityLabels[2], color: priorityColors[2] },
  3: { id: 3, label: priorityLabels[3], color: priorityColors[3] },
  4: { id: 4, label: priorityLabels[4], color: priorityColors[4] },
  5: { id: 5, label: priorityLabels[5], color: priorityColors[5] },
};

type Props = { groupedActivities: GroupedActivities; isLoading?: boolean };

export default function Priorities({ groupedActivities, isLoading }: Props) {
  return (
    !!groupedActivities?.priorities?.length && (
      <Grid>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle('Activities by Priority')}
          <PieChart
            series={[
              {
                id: 'activities-by-priority',
                valueFormatter: item => `${item.value} ${pluralizeMemo('activity', item.value)}`,
                data: groupedActivities.priorities.map(p => ({
                  value: p.count,
                  ...priorityDefs[p.id],
                })),
                outerRadius: 100,
              },
            ]}
            margin={{ left: 100 }}
            {...widgetSize}
            slotProps={{ legend: { hidden: true } }}
          />
        </Paper>
      </Grid>
    )
  );
}
