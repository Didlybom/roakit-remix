import { compileExpression, useDotAccessOperatorAndOptionalChaining } from 'filtrex';
import stringify from 'json-stable-stringify';
import type { ActivityData, InitiativeData, InitiativeRecord } from '../types/types';

// see https://github.com/joewalnes/filtrex

export enum MapperType {
  Initiative,
  LaunchItem,
}

let compiledExpressions: Record<
  MapperType,
  Record<InitiativeData['id'], (obj: unknown) => unknown>
> = {
  [MapperType.Initiative]: {},
  [MapperType.LaunchItem]: {},
};
let expressionsHash: Record<MapperType, string> = {
  [MapperType.Initiative]: '',
  [MapperType.LaunchItem]: '',
};

export const clearActivityMapperCache = () => {
  compiledExpressions = {
    [MapperType.Initiative]: {},
    [MapperType.LaunchItem]: {},
  };
  expressionsHash = {
    [MapperType.Initiative]: '',
    [MapperType.LaunchItem]: '',
  };
};

export const compileActivityMappers = (type: MapperType, map: InitiativeRecord) => {
  const hash = stringify(
    Object.values(map)
      .filter(i => !i.activityMapper)
      .map(i => i.activityMapper)
  );
  if (hash === expressionsHash[type]) {
    return compiledExpressions;
  }
  compiledExpressions[type] = {};
  Object.keys(map).forEach(initiativeId => {
    if (map[initiativeId].activityMapper) {
      compiledExpressions[type][initiativeId] = compileExpression(
        map[initiativeId].activityMapper!,
        {
          customProp: useDotAccessOperatorAndOptionalChaining,
        }
      );
    }
  });
  expressionsHash[type] = hash;
};

export const mapActivity = (activity: ActivityData | Omit<ActivityData, 'id'>) => {
  const initiatives: string[] = [];
  const launchItems: string[] = [];

  // Note: Filtrex returns an error as a string (so, not === true) when something goes wrong.
  //       It doesn't throw.
  Object.keys(compiledExpressions[MapperType.Initiative]).forEach(id => {
    if (compiledExpressions[MapperType.Initiative][id](activity) === true) {
      initiatives.push(id);
    }
  });

  Object.keys(compiledExpressions[MapperType.LaunchItem]).forEach(id => {
    if (compiledExpressions[MapperType.LaunchItem][id](activity) === true) {
      launchItems.push(id);
    }
  });

  return { initiatives, launchItems };
};
