import { Input, type InputProps } from "@heroui/input";
import clsx from "clsx";

export const neonInputClassNames = {
  inputWrapper:
    "bg-transparent border border-foreground/10 data-[hover=true]:border-foreground/20 rounded-none",
  input: "text-sm text-foreground/80",
} as const;

export function NeonInput({
  classNames,
  variant = "bordered",
  ...props
}: InputProps) {
  return (
    <Input
      classNames={{
        ...neonInputClassNames,
        ...classNames,
        inputWrapper: clsx(
          neonInputClassNames.inputWrapper,
          classNames?.inputWrapper,
        ),
        input: clsx(neonInputClassNames.input, classNames?.input),
      }}
      variant={variant}
      {...props}
    />
  );
}
