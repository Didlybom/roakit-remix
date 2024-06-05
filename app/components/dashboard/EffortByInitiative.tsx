import { Box, Paper, Typography } from '@mui/material';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts';
import type { GroupedActivities } from '../../types/activityFeed';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  isLoading?: boolean;
};

export default function InitiativeEffort({ groupedActivities, initiatives, isLoading }: Props) {
  return (
    !!initiatives &&
    !!groupedActivities?.initiatives?.length && (
      <Box>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle('Effort by Goal')}
          <PieChart
            series={[
              {
                id: 'effort-by-initiative',
                data: groupedActivities.initiatives.map(initiative => ({
                  id: initiatives[initiative.id].key,
                  value: initiative.effort,
                  label: initiatives[initiative.id].label,
                })),
                arcLabel: item => `${item.id}`,
                outerRadius: 100,
                innerRadius: 30,
              },
            ]}
            margin={{ left: 100 }}
            sx={{ [`& .${pieArcLabelClasses.root}`]: { fill: 'white' } }}
            {...widgetSize}
            slotProps={{ legend: { hidden: true } }}
            colors={pastelColors}
          />
        </Paper>
        <Typography variant="caption" justifyContent="center" sx={{ mt: -3, display: 'flex' }}>
          simulated data
        </Typography>
      </Box>
    )
  );
}
