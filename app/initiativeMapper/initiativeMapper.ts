import { compileExpression, useDotAccessOperator } from 'filtrex';
import stringify from 'json-stable-stringify';
import type { ActivityData, InitiativeData } from '../types/types';

// see https://github.com/joewalnes/filtrex

let compiledExpressions: Record<InitiativeData['id'], (obj: unknown) => unknown>;
let expressionsHash = '';

export const clearExpressionsCache = () => {
  compiledExpressions = {};
  expressionsHash = '';
};

export const compileExpressions = (
  map: Record<InitiativeData['id'], InitiativeData['activityMapper']>
) => {
  const hash = stringify(map);
  if (hash === expressionsHash) {
    return compiledExpressions;
  }
  compiledExpressions = {};
  Object.keys(map).forEach(initiativeId => {
    if (map[initiativeId]) {
      compiledExpressions[initiativeId] = compileExpression(map[initiativeId]!, {
        customProp: useDotAccessOperator,
      });
    }
  });
  expressionsHash = hash;
  return compiledExpressions;
};

export const evalActivity = (activity: ActivityData): string[] => {
  const initiatives: string[] = [];
  Object.keys(compiledExpressions).forEach(initiativeId => {
    if (compiledExpressions[initiativeId](activity) === true) {
      initiatives.push(initiativeId);
    }
  });
  return initiatives;
};
