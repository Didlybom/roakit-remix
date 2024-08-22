import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { activityTypes } from '../../processors/activityFeed';
import { TOP_ACTORS_OTHERS_ID, type GroupedActivities } from '../../processors/activityGrouper';
import type { ActorRecord } from '../../types/types';
import { windowOpen } from '../../utils/jsxUtils';
import { pluralizeMemo } from '../../utils/stringUtils';
import theme from '../../utils/theme';
import { commonPaperSx, widgetSize, widgetTitle } from './common';

type Props = {
  groupedActivities: GroupedActivities;
  actors: ActorRecord | null;
  isLoading?: boolean;
};

export default function ActiveContributors({ groupedActivities, actors, isLoading }: Props) {
  return (
    !!groupedActivities?.topActors &&
    actors &&
    Object.keys(groupedActivities.topActors)
      .sort(
        (a, b) =>
          (activityTypes.get(a)?.sortOrder ?? 999) - (activityTypes.get(b)?.sortOrder ?? 999)
      )
      .map(activityType => (
        <Grid key={activityType}>
          <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
            {widgetTitle(activityTypes.get(activityType)?.label ?? activityType)}
            <BarChart
              series={[
                {
                  id: `top-actors-${activityType}`,
                  valueFormatter: val => `${val} ${pluralizeMemo('activity', val ?? 0)}`,
                  data: groupedActivities.topActors![activityType].map(a => a.count),
                },
              ]}
              yAxis={[
                {
                  data: groupedActivities.topActors![activityType].map(a =>
                    a.id === TOP_ACTORS_OTHERS_ID ? 'All others' : (actors[a.id]?.name ?? 'unknown')
                  ),
                  scaleType: 'band',
                },
              ]}
              onItemClick={(event, data) => {
                if (data) {
                  windowOpen(
                    event,
                    `/feed/${
                      data.dataIndex === 10 ?
                        '*'
                      : encodeURI(groupedActivities.topActors![activityType][data.dataIndex].id)
                    }?activityType=${activityType}`
                  );
                }
              }}
              onAxisClick={(event, data) => {
                if (data) {
                  windowOpen(
                    event,
                    `/feed/${
                      data.dataIndex === 10 ?
                        '*'
                      : encodeURI(groupedActivities.topActors![activityType][data.dataIndex].id)
                    }?activityType=${activityType}`
                  );
                }
              }}
              xAxis={[{ tickMinStep: 1 }]}
              layout="horizontal"
              {...widgetSize}
              margin={{ top: 15, right: 20, bottom: 30, left: 170 }}
              slotProps={{ legend: { hidden: true } }}
              colors={[theme.palette.primary.main]}
            />
          </Paper>
        </Grid>
      ))
  );
}
