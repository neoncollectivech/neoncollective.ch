import { NeonTextButton } from "@/components/neon-text-button";

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
    <div className="flex min-w-0 flex-wrap items-center gap-3 mb-4">
      <div className="neon-label flex items-center gap-2 normal-case tracking-wider">
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
        <NeonTextButton
          className="text-xs font-normal text-foreground/50 hover:text-neon"
          onClick={onChangeLevel}
        >
          {changeLevelLabel}
        </NeonTextButton>
      ) : null}
    </div>
  );
}
