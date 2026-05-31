type ContributionStepperProps = {
  step: 1 | 2;
  chooseLabel: string;
  completeLabel: string;
  onChangeLevel?: () => void;
  changeLevelLabel?: string;
};

export function ContributionStepper({
  step,
  chooseLabel,
  completeLabel,
  onChangeLevel,
  changeLevelLabel,
}: ContributionStepperProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
        <span
          className={
            step === 1 ? "text-neon/80" : "text-foreground/30 line-through"
          }
        >
          {chooseLabel}
        </span>
        <span className="text-foreground/20">→</span>
        <span className={step === 2 ? "text-neon/80" : "text-foreground/40"}>
          {completeLabel}
        </span>
      </div>
      {step === 2 && onChangeLevel && changeLevelLabel ? (
        <button
          className="text-xs text-foreground/50 hover:text-neon underline-offset-2 hover:underline"
          type="button"
          onClick={onChangeLevel}
        >
          {changeLevelLabel}
        </button>
      ) : null}
    </div>
  );
}
