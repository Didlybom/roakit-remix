import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import type { GroupedActivities } from '../../processors/activityGrouper';
import type { InitiativeRecord } from '../../types/types';
import { pluralizeMemo } from '../../utils/stringUtils';
import { commonPaperSx, pastelColors, widgetSize, widgetTitle } from './common';

type Props = {
  type: 'initiatives' | 'launchItems';
  groupedActivities: GroupedActivities;
  initiatives: InitiativeRecord | null;
  dateRangeLabel: string;
  isLoading?: boolean;
};

export default function ArtifactsByInitiatives({
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

  return groupedActivities[type].map(initiative => {
    const totalCounters = initiatives[initiative.id].counters!.activities;
    return (
      <Grid key={initiative.id}>
        <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
          {widgetTitle(initiatives[initiative.id]?.label ?? 'Unknown')}
          <BarChart
            series={[
              {
                id: `${initiative.id} artifacts`,
                data: [
                  initiative.artifactCount.code,
                  initiative.artifactCount.codeOrg,
                  initiative.artifactCount.task,
                  initiative.artifactCount.taskOrg,
                  initiative.artifactCount.doc,
                  initiative.artifactCount.docOrg,
                ],
                valueFormatter: value => `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                label: dateRangeLabel,
                stack: 'stack',
                color: initiatives[initiative.id]?.color || undefined,
              },
              ...(SHOW_TOTAL ?
                [
                  {
                    id: `${initiative.id} artifacts total`,
                    data: [
                      // max() is useful is totalCounters are behind (updated every hour only)
                      Math.max(totalCounters.code, initiative.artifactCount.code),
                      Math.max(totalCounters.codeOrg, initiative.artifactCount.codeOrg),
                      Math.max(totalCounters.task, initiative.artifactCount.task),
                      Math.max(totalCounters.taskOrg, initiative.artifactCount.taskOrg),
                      Math.max(totalCounters.codeOrg, initiative.artifactCount.doc),
                      Math.max(totalCounters.taskOrg, initiative.artifactCount.docOrg),
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
                data: ['Dev', 'Dev Org', 'Task', 'Task Org', 'Doc', 'Doc Org'],
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
