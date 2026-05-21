type InlineSpinnerProps = {
  className?: string;
};

export function InlineSpinner({ className }: InlineSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-foreground ${className ?? ""}`}
    />
  );
}
