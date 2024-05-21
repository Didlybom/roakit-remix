import MarkdownToJSX from 'markdown-to-jsx';

export default function MarkdownText({ markdownText }: { markdownText: string }) {
  return (
    <MarkdownToJSX options={{ overrides: { a: { component: 'span' } } }}>
      {markdownText}
    </MarkdownToJSX>
  );
}
