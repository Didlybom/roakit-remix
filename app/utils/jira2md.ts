// see https://github.com/kylefarris/J2M
// Fixed a few things. Still not prefect.

const UNORDERED_LIST = new RegExp(/^[ \t]*(\*+)\s+/gm);
const ORDERED_LIST = new RegExp(/^[ \t]*(#+)\s+/gm);
const HEADER = new RegExp(/^h([0-6])\.(.*)$/gm);
const BOLD = new RegExp(/\*(\S.*?)\*/g);
const ITALIC = new RegExp(/_(\S.*?)_/g);
const MONOSPACED = new RegExp(/\{\{([^}]+)\}\}/g);
//const INSERT = new RegExp(/\+([^+]*?)\+/g);
//const SUPERSCRIPT = new RegExp(/\^([^^]*?)\^/g);
//const SUBSCRIPT = new RegExp(/~([^~]*?)~/g);
const STRIKETHROUGH = new RegExp(/(\s+)-(\S+.*?\S)-(\s+)/g);
const CODE = new RegExp(
  /\{code(:([a-z]+))?([:|]?(title|borderStyle|borderColor|borderWidth|bgColor|titleBGColor)=.+?)*\}([^]*?)\n?\{code\}/gm
);
const PRE = new RegExp(/{noformat}/g);
const UNNAMED_LINK = new RegExp(/\[([^|]+?)\]/g);
const IMAGE = new RegExp(/!(.+)!/g);
const NAMED_LINK = new RegExp(/\[(.+?)\|(.+?)\]/g);
const BLOCKQUOTE = new RegExp(/^bq\.\s+/gm);
const COLOR = new RegExp(/\{color:[^}]+\}([^]*?)\{color\}/gm);
const PANEL = new RegExp(/\{panel:title=([^}]*)\}\n?([^]*?)\n?\{panel\}/gm);
const TABLE_HEADER = new RegExp(/^[ \t]*((?:\|\|.*?)+\|\|)[ \t]*$/gm);
const TABLE_LEADING_SPACE = new RegExp(/^[ \t]*\|/gm);

export const jira2md = (str: string) =>
  str
    // Un-Ordered Lists
    .replace(UNORDERED_LIST, (_match, stars) => {
      return `${Array(stars.length).join('  ')}* `;
    })
    // Ordered lists
    .replace(ORDERED_LIST, (_match, nums) => {
      return `${Array(nums.length).join('   ')}1. `;
    })
    // Headers 1-6
    .replace(HEADER, (_match, level, content) => {
      return Array(parseInt(level, 10) + 1).join('#') + content;
    })
    // Bold
    .replace(BOLD, '**$1**')
    // Italic
    .replace(ITALIC, '*$1*')
    // Monospaced text
    .replace(MONOSPACED, '`$1`')
    // Citations (buggy)
    // .replace(/\?\?((?:.[^?]|[^?].)+)\?\?/g, '<cite>$1</cite>')
    // Inserts
    //.replace(INSERT, '<ins>$1</ins>') // breaks links
    // Superscript
    //.replace(SUPERSCRIPT, '<sup>$1</sup>')
    // Subscript
    //.replace(SUBSCRIPT, '<sub>$1</sub>')
    // Strikethrough
    .replace(STRIKETHROUGH, '$1~~$2~~$3')
    // Code Block
    .replace(CODE, '```$2$5\n```')
    // Pre-formatted text
    .replace(PRE, '```')
    // Un-named Links
    .replace(UNNAMED_LINK, '<$1>')
    // Images
    .replace(IMAGE, '![]($1)')
    // Named Links
    .replace(NAMED_LINK, '[$1]($2)')
    // Single Paragraph Blockquote
    .replace(BLOCKQUOTE, '> ')
    // Remove color: unsupported in md
    .replace(COLOR, '$1')
    // panel into table
    .replace(PANEL, '\n| $1 |\n| --- |\n| $2 |')
    // table header
    .replace(TABLE_HEADER, (match, headers) => {
      const singleBarred = headers.replace(/\|\|/g, '|');
      return `\n${singleBarred}\n${singleBarred.replace(/\|[^|]+/g, '| --- ')}`;
    })
    // remove leading-space of table headers and rows
    .replace(TABLE_LEADING_SPACE, '|');
// // remove unterminated inserts across table cells
// .replace(/\|([^<]*)<ins>(?![^|]*<\/ins>)([^|]*)\|/g, (_, preceding, following) => {
//     return `|${preceding}+${following}|`;
// })
// // remove unopened inserts across table cells
// .replace(/\|(?<![^|]*<ins>)([^<]*)<\/ins>([^|]*)\|/g, (_, preceding, following) => {
//     return `|${preceding}+${following}|`;
// })
