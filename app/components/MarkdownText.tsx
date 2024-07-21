import MarkdownToJSX from 'markdown-to-jsx';

export default function MarkdownText({
  text,
  ignoreLinks,
}: {
  text: string;
  ignoreLinks?: boolean;
}) {
  return (
    <MarkdownToJSX options={{ ...(ignoreLinks && { overrides: { a: { component: 'span' } } }) }}>
      {text}
    </MarkdownToJSX>
  );
}
