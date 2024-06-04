import { compileExpression, useDotAccessOperatorAndOptionalChaining } from 'filtrex';
import stringify from 'json-stable-stringify';
import type { ActivityData, InitiativeData, InitiativeRecord } from '../types/types';

// see https://github.com/joewalnes/filtrex

let compiledExpressions: Record<InitiativeData['id'], (obj: unknown) => unknown>;
let expressionsHash = '';

export const clearInitiativeMapperCache = () => {
  compiledExpressions = {};
  expressionsHash = '';
};

export const compileInitiativeMappers = (map: InitiativeRecord) => {
  const hash = stringify(
    Object.values(map)
      .filter(i => !i.activityMapper)
      .map(i => i.activityMapper)
  );
  if (hash === expressionsHash) {
    return compiledExpressions;
  }
  compiledExpressions = {};
  Object.keys(map).forEach(initiativeId => {
    if (map[initiativeId].activityMapper) {
      compiledExpressions[initiativeId] = compileExpression(map[initiativeId].activityMapper!, {
        customProp: useDotAccessOperatorAndOptionalChaining,
      });
    }
  });
  expressionsHash = hash;
  return compiledExpressions;
};

export const mapActivity = (activity: ActivityData | Omit<ActivityData, 'id'>): string[] => {
  const initiatives: string[] = [];
  Object.keys(compiledExpressions).forEach(initiativeId => {
    if (compiledExpressions[initiativeId](activity) === true) {
      initiatives.push(initiativeId);
    }
  });
  return initiatives;
};
