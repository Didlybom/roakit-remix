import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import {
  BarChart,
  DefaultChartsAxisTooltipContent,
  type ChartsAxisContentProps,
} from '@mui/x-charts';
import type { GroupedActivities } from '../../types/activityFeed';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pastelColors, pluralizeMemo, widgetSize, widgetTitle } from './common';

type Props = {
  type: 'initiatives' | 'launchItems';

  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  isLoading?: boolean;
};

export default function ContributorsByInitiative({
  type,
  groupedActivities,
  initiatives,
  isLoading,
}: Props) {
  const ContributorsByInitiativeTooltipContent = (props: ChartsAxisContentProps) => {
    return initiatives ?
        <DefaultChartsAxisTooltipContent
          {...props}
          axisValue={initiatives[props.axisValue as string]?.label ?? (props.axisValue as string)}
        />
      : <DefaultChartsAxisTooltipContent {...props} />;
  };

  if (!initiatives || !groupedActivities?.[type]?.length) {
    return null;
  }
  return (
    <Grid>
      <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
        {widgetTitle(type === 'initiatives' ? 'Contributors by Goal' : 'Launch Contributors')}
        <BarChart
          series={[
            {
              id: `contributors-${type}`,
              valueFormatter: value => `${value} ${pluralizeMemo('contributor', value ?? 0)}`,
              data: groupedActivities[type]!.map(i => i.actorCount),
            },
          ]}
          yAxis={[
            {
              data: groupedActivities[type]!.map(i => initiatives[i.id].key),
              scaleType: 'band',
            },
          ]}
          xAxis={[{ tickMinStep: 1 }]}
          layout="horizontal"
          {...widgetSize}
          slotProps={{ legend: { hidden: true } }}
          colors={pastelColors}
          tooltip={{ trigger: 'axis', axisContent: ContributorsByInitiativeTooltipContent }}
        />
      </Paper>
    </Grid>
  );
}
