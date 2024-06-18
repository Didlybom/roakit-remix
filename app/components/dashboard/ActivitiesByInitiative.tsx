import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { InitiativeRecord } from '../../types/types';
import type { GroupedActivities } from '../../utils/activityFeed';
import { commonPaperSx, pastelColors, pluralizeMemo, widgetSize, widgetTitle } from './common';

type Props = {
  type: 'initiatives' | 'launchItems';
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function ActivitiesByInitiatives({
  type,
  groupedActivities,
  initiatives,
  dateRangeLabel,
  isLoading,
}: Props) {
  if (!initiatives || !groupedActivities?.[type]?.length) {
    return null;
  }

  const SHOW_TOTAL = false;

  return groupedActivities[type]!.map(initiative => {
    const totalCounters = initiatives[initiative.id].counters!.activities;
    return (
      <Grid key={initiative.id}>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
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
                  initiative.count.doc,
                  initiative.count.docOrg,
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                label: dateRangeLabel,
                stack: 'stack',
              },
              ...(SHOW_TOTAL ?
                [
                  {
                    id: `${initiative.id} total`,
                    data: [
                      // max() is useful is totalCounters are behind (updated every hour only)
                      Math.max(totalCounters.code, initiative.count.code),
                      Math.max(totalCounters.task, initiative.count.task),
                      Math.max(totalCounters.codeOrg, initiative.count.codeOrg),
                      Math.max(totalCounters.taskOrg, initiative.count.taskOrg),
                      Math.max(totalCounters.codeOrg, initiative.count.doc),
                      Math.max(totalCounters.taskOrg, initiative.count.docOrg),
                    ],
                    valueFormatter: (value: number | null) =>
                      `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                    label: 'Total',
                    stack: 'stack',
                  },
                ]
              : []),
            ]}
            xAxis={[
              {
                data: ['Dev', 'Task', 'Dev Org', 'Task Org', 'Doc', 'Doc Org'],
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
                hidden: !SHOW_TOTAL,
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
