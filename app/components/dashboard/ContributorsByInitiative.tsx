import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import {
  BarChart,
  DefaultChartsAxisTooltipContent,
  type ChartsAxisContentProps,
} from '@mui/x-charts';
import { useCallback } from 'react';
import type { GroupedActivities } from '../../processors/activityGrouper';
import type { InitiativeRecord } from '../../types/types';
import { pluralizeMemo } from '../../utils/stringUtils';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  isLoading?: boolean;
};

export default function ContributorsByInitiative({
  groupedActivities,
  initiatives,
  isLoading,
}: Props) {
  const TooltipContent = useCallback(
    (props: ChartsAxisContentProps) =>
      initiatives ?
        <DefaultChartsAxisTooltipContent
          {...props}
          axisValue={
            Object.values(initiatives).find(i => i.key === props.axisValue)?.label ??
            props.axisValue
          }
        />
      : <DefaultChartsAxisTooltipContent {...props} />,
    [initiatives]
  );

  if (!initiatives || !groupedActivities?.initiatives?.length) return null;
  return (
    <Grid>
      <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
        {widgetTitle('# Contributors by Initiative')}
        <BarChart
          series={[
            {
              id: `contributors-by-initiative`,
              valueFormatter: value => `${value} ${pluralizeMemo('contributor', value ?? 0)}`,
              data: groupedActivities.initiatives.map(i => i.actorCount),
            },
          ]}
          yAxis={[
            {
              data: groupedActivities.initiatives.map(i => initiatives[i.id].key),
              colorMap: {
                type: 'ordinal',
                colors: groupedActivities.initiatives.map(
                  i => initiatives[i.id].color ?? pastelColors[0]
                ),
              },
              scaleType: 'band',
            },
          ]}
          xAxis={[{ tickMinStep: 1 }]}
          layout="horizontal"
          {...widgetSize}
          margin={{ top: 15, right: 20, bottom: 30, left: 70 }}
          slotProps={{ legend: { hidden: true } }}
          colors={pastelColors}
          tooltip={{ trigger: 'axis', axisContent: TooltipContent }}
        />
      </Paper>
    </Grid>
  );
}
