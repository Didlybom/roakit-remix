import memoize from 'fast-memoize';
import pluralize from 'pluralize';

export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const caseInsensitiveCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export const JIRA_TICKET_REGEXP = new RegExp(/([A-Z]+-[0-9]+)/); // /([A-Z][A-Z0-9]+-[0-9]+)/;
export const JIRA_FAKE_TICKET_REGEXP = new RegExp(/([A-Z]+)-0+$/);
const JIRA_PROJECT_REGEXP_G = new RegExp(/([A-Z]+)(?=-[0-9]+)/g);
export const JIRA_TICKET_REGEXP_G = new RegExp(/([A-Z]+-[0-9]+)/g);

export const JIRA_ACCOUNT_REGEXP_G = new RegExp(/(?:\[~accountid:)(.+?)(?:\])/g);
export const JIRA_IMAGE_REGEXP_G = new RegExp(/!(.+?)!/g);
export const JIRA_IMAGE2_REGEXP_G = new RegExp(/\[\^(.+?)\]/g);
export const MENTION_REGEXP_G = new RegExp(/\B@([\w-]+)/g);
export const IMG_TAG_REGEXP_G = new RegExp(/(<img.+?>)/g);

export const LABEL_REGEXP = new RegExp(/^([A-Za-z ]+): /);

export const findJiraProjects = (data?: string): string[] => {
  if (!data) {
    return [];
  }
  const projects = new Set<string>();
  [...data.matchAll(JIRA_PROJECT_REGEXP_G)].forEach(m => {
    projects.add(m[1]); // dedupes
  });
  return [...projects];
};

export const findJiraTickets = (data?: string): string[] => {
  if (!data) {
    return [];
  }
  const projects = new Set<string>();
  [...data.matchAll(JIRA_TICKET_REGEXP_G)].forEach(m => {
    projects.add(m[1]); // dedupes
  });
  return [...projects];
};

export const linkifyJiraAccount = (data: string) => {};

export const removeSpaces = (data: string): string => data.replace(/\s/g, '');

export const capitalizeAndUseSpaces = (data?: string) =>
  !data ? '' : (data.charAt(0).toUpperCase() + data.slice(1)).replace(/_/g, ' ');

export const sortAndFormatRecord = <T>(data: Record<string, T>) =>
  JSON.stringify(data, Object.keys(data).sort(), 2);

export const mimeTypeToType = (mimeType: string): string | undefined => {
  if (mimeType.startsWith('image')) {
    return 'image';
  }
  if (mimeType.startsWith('audio')) {
    return 'audio';
  }
  if (mimeType.startsWith('video')) {
    return 'video';
  }
  if (mimeType.includes('cal')) {
    return 'calendar';
  }
  if (mimeType.startsWith('text')) {
    return 'text';
  }
  if (mimeType.includes('zip') || mimeType.includes('compress')) {
    return 'archive';
  }
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }
  if (mimeType === 'application/xml') {
    return 'XML';
  }
  if (mimeType.startsWith('application')) {
    return 'document';
  }
  return undefined;
};

export const pluralizeMemo = memoize(pluralize);

// see https://github.com/ericvera/name-initials/blob/master/src/name-initials.js

const LETTER_REGEXP = /^[a-z\u00C0-\u017F]/i;

export const nameInitials = (name: string | undefined) => {
  if (!name) return undefined;

  const nameTokens = name.toUpperCase().split(/[\s+-]/);
  let tokens = [];

  let initials = '';

  // Remove all tokens after the first that starts with a non-letter character
  for (var i = 0; i < nameTokens.length; i++) {
    if (!LETTER_REGEXP.test(nameTokens[i])) {
      break;
    }
    tokens.push(nameTokens[i]);
  }

  if (tokens.length >= 1) {
    initials += tokens[0].slice(0, 1);
  }

  if (tokens.length >= 2) {
    // Find first non-initial
    let foundNonInitial = false;

    for (let i = 1; i < tokens.length; i++) {
      if (!tokens[i].match(/.\./)) {
        foundNonInitial = true;
        initials += tokens[i].slice(0, 1);
        break;
      }
    }

    if (!foundNonInitial) {
      initials += tokens[1].slice(0, 1);
    }
  }

  return initials;
};

const normalizeHash = (hash: number, min: number, max: number) =>
  Math.floor((hash % (max - min)) + min);

// see https://dev.to/admitkard/auto-generate-avatar-colors-randomly-138j
export const stringColor = (string: string | undefined) => {
  if (!string) return undefined;
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  const h = normalizeHash(hash, 0, 360);
  const s = normalizeHash(hash, 55, 75);
  const l = normalizeHash(hash, 35, 55);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const convertEmojis = (string: string | undefined) =>
  string
    ?.replaceAll('(/)', '✅')
    .replaceAll('(x)', '❌')
    .replaceAll('(flag)', '🚩')
    .replaceAll(':santa:', '🎅')
    .replaceAll(':slightly_smiling_face:', '🙂');
