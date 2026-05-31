import MDEditor from "@uiw/react-md-editor";

import "@uiw/react-md-editor/markdown-editor.css";

type MarkdownFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
};

export function MarkdownField({
  id,
  value,
  onChange,
  minHeight = 200,
}: MarkdownFieldProps) {
  return (
    <div data-color-mode="dark">
      <MDEditor
        id={id}
        minHeight={minHeight}
        preview="live"
        textareaProps={{ id }}
        value={value}
        visibleDragbar={false}
        onChange={(next) => onChange(next ?? "")}
      />
    </div>
  );
}

type MarkdownContentProps = {
  source: string;
  className?: string;
};

export function MarkdownContent({ source, className }: MarkdownContentProps) {
  return (
    <div className={className} data-color-mode="dark">
      <MDEditor.Markdown source={source} />
    </div>
  );
}
