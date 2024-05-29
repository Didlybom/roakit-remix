import { Paper } from '@mui/material';
import {
  BarChart,
  DefaultChartsAxisTooltipContent,
  type ChartsAxisContentProps,
} from '@mui/x-charts';
import type { GroupedActivities } from '../../types/activityFeed';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pluralizeMemo, widgetSize, widgetTitle } from './common';

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
  const ContributorsByInitiativeTooltipContent = (props: ChartsAxisContentProps) => {
    return initiatives ?
        <DefaultChartsAxisTooltipContent
          {...props}
          axisValue={initiatives[props.axisValue as string]?.label ?? (props.axisValue as string)}
        />
      : <DefaultChartsAxisTooltipContent {...props} />;
  };

  return (
    !!initiatives &&
    !!groupedActivities?.initiatives?.length && (
      <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
        {widgetTitle('Contributors by Goal')}
        <BarChart
          series={[
            {
              id: 'contributors-by-initiative',
              valueFormatter: value => `${value} ${pluralizeMemo('contributor', value ?? 0)}`,
              data: groupedActivities.initiatives.map(i => i.actorCount),
            },
          ]}
          yAxis={[
            {
              data: groupedActivities.initiatives.map(i => initiatives[i.id].key),
              scaleType: 'band',
            },
          ]}
          xAxis={[{ tickMinStep: 1 }]}
          layout="horizontal"
          {...widgetSize}
          slotProps={{ legend: { hidden: true } }}
          tooltip={{ trigger: 'axis', axisContent: ContributorsByInitiativeTooltipContent }}
        />
      </Paper>
    )
  );
}
