import { Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { GroupedActivities } from '../../types/activityFeed';
import type { InitiativeRecord } from '../../types/types';
import { commonPaperSx, pluralizeMemo, widgetSize, widgetTitle } from './common';

type Props = {
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function ActivitiesByInitiatives({
  groupedActivities,
  initiatives,
  dateRangeLabel,
  isLoading,
}: Props) {
  return (
    !!initiatives &&
    groupedActivities?.initiatives?.map(initiative => {
      const totalCounters = initiatives[initiative.id].counters.activities;
      return (
        <Paper key={initiative.id} variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle(initiatives[initiative.id]?.label ?? 'Unknown')}
          <BarChart
            series={[
              {
                id: `${initiative.id} new`,
                data: [
                  initiative.count.code,
                  initiative.count.task,
                  initiative.count.codeOrg,
                  initiative.count.taskOrg,
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                label: dateRangeLabel,
                stack: 'total',
              },
              {
                id: `${initiative.id} total`,
                data: [
                  // max() is useful is totalCounters are behind (updated every hour only)
                  Math.max(totalCounters.code, initiative.count.code),
                  Math.max(totalCounters.task, initiative.count.task),
                  Math.max(totalCounters.codeOrg, initiative.count.codeOrg),
                  Math.max(totalCounters.taskOrg, initiative.count.taskOrg),
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                label: 'Total',
                stack: 'total',
              },
            ]}
            xAxis={[
              {
                data: ['Dev', 'Task', 'Dev Org', 'Task Org'],
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
          />
        </Paper>
      );
    })
  );
}
