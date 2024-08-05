import MarkdownToJSX from 'markdown-to-jsx';

export default function MarkdownText({
  text,
  ignoreLinks,
}: {
  text: string;
  ignoreLinks?: boolean;
}) {
  return (
    <MarkdownToJSX
      options={{
        disableParsingRawHTML: true,
        ...(ignoreLinks && { overrides: { a: { component: 'span' } } }),
      }}
    >
      {text}
    </MarkdownToJSX>
  );
}
