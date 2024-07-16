import { Unstable_Grid2 as Grid, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { artifactActions } from '../../activityProcessors/activityFeed';
import {
  TOP_ACTORS_OTHERS_ID,
  type GroupedActivities,
} from '../../activityProcessors/activityGrouper';
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
          (artifactActions.get(a)?.sortOrder ?? 999) - (artifactActions.get(b)?.sortOrder ?? 999)
      )
      .map(action => (
        <Grid key={action}>
          <Paper variant="outlined" sx={commonPaperSx({ isLoading })}>
            {widgetTitle(artifactActions.get(action)?.label ?? action)}
            <BarChart
              series={[
                {
                  id: `top-actors-${action}`,
                  valueFormatter: val => `${val} ${pluralizeMemo('activity', val ?? 0)}`,
                  data: groupedActivities.topActors![action].map(a => a.count),
                },
              ]}
              yAxis={[
                {
                  data: groupedActivities.topActors![action].map(a =>
                    a.id === TOP_ACTORS_OTHERS_ID ? 'All others' : (actors[a.id]?.name ?? 'unknown')
                  ),
                  scaleType: 'band',
                },
              ]}
              onItemClick={(event, data) => {
                if (data) {
                  windowOpen(
                    event.nativeEvent,
                    `/activity/${
                      data.dataIndex === 10 ?
                        '*'
                      : encodeURI(groupedActivities.topActors![action][data.dataIndex].id)
                    }?action=${action}`
                  );
                }
              }}
              onAxisClick={(event, data) => {
                if (data) {
                  windowOpen(
                    event,
                    `/activity/${
                      data.dataIndex === 10 ?
                        '*'
                      : encodeURI(groupedActivities.topActors![action][data.dataIndex].id)
                    }?action=${action}`
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
