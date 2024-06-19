import { compileExpression } from 'filtrex';
import stringify from 'json-stable-stringify';
import type { Activity, Initiative, InitiativeRecord } from '../types/types';

// see https://github.com/joewalnes/filtrex

export enum MapperType {
  Initiative,
  LaunchItem,
}

let compiledExpressions: Record<MapperType, Record<Initiative['id'], (obj: unknown) => unknown>> = {
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

// Adapted from https://github.com/m93a/filtrex/blob/main/src/filtrex.mjs#L208
const useDotAccessOperatorWithArrayAndOptionalChaining = (
  name: string,
  get: (name: string) => unknown,
  obj: unknown,
  type: 'unescaped' | 'single-quoted'
) => {
  if (obj == null) {
    return obj;
  }

  // ignore dots inside escaped symbol
  if (type === 'single-quoted') {
    return get(name);
  }

  const parts = name.split('.');

  for (const propertyName of parts) {
    if (obj == null) {
      return obj;
    }
    if (propertyName.endsWith('_1st')) {
      // evaluate the 1st element of the array, e.g. metadata.commits_1st.message => metadata.commits[0].message
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const arr = (obj as any)[propertyName.slice(0, -4)];
      if (Array.isArray(arr) && arr.length > 0) {
        obj = arr[0];
      } else {
        return obj;
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      obj = (obj as any)[propertyName];
    }
  }

  return obj;
};

const options = {
  customProp: useDotAccessOperatorWithArrayAndOptionalChaining,
  operators: {
    '~=': (a: string, b: string) => (b == null ? false : RegExp(b, 'i').test(a)),
  },
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
        // @ts-expect-error no need to overwrite all Operators
        options
      );
    }
  });
  expressionsHash[type] = hash;
};

export const mapActivity = (activity: Activity | Omit<Activity, 'id'>) => {
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
