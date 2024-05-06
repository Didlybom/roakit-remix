import MarkdownToJSX from 'markdown-to-jsx';

export default function Markdown({ markdownText }: { markdownText: string }) {
  return (
    <MarkdownToJSX options={{ overrides: { a: { component: 'span' } } }}>
      {markdownText}
    </MarkdownToJSX>
  );
}
