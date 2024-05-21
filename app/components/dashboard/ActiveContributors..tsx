import { Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import {
  TOP_ACTORS_OTHERS_ID,
  artifactActions,
  type GroupedActivities,
} from '../../types/activityFeed';
import type { ActorRecord } from '../../types/types';
import { windowOpen } from '../../utils/jsxUtils';
import { commonPaperSx, pluralizeMemo, widgetSize, widgetTitle } from './common';

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
        <Paper key={action} variant="outlined" sx={commonPaperSx({ isLoading })}>
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
                  a.id === TOP_ACTORS_OTHERS_ID ? 'All others' : actors[a.id]?.name ?? 'unknown'
                ),
                scaleType: 'band',
              },
            ]}
            xAxis={[{ tickMinStep: 1 }]}
            onItemClick={(event, data) => {
              if (data) {
                windowOpen(
                  event.nativeEvent,
                  `/activity/user/${
                    data.dataIndex === 10 ?
                      '*'
                    : encodeURI(groupedActivities.topActors![action][data.dataIndex].id)
                  }#${action}`
                );
              }
            }}
            onAxisClick={(event, data) => {
              if (data) {
                windowOpen(
                  event,
                  `/activity/user/${
                    data.dataIndex === 10 ?
                      '*'
                    : encodeURI(groupedActivities.topActors![action][data.dataIndex].id)
                  }#${action}`
                );
              }
            }}
            layout="horizontal"
            {...widgetSize}
            margin={{ top: 10, right: 20, bottom: 30, left: 170 }}
            slotProps={{ legend: { hidden: true } }}
          />
        </Paper>
      ))
  );
}
