"use client";

import { useEffect, useRef } from "react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useWebOtpAutofill } from "@/hooks/use-web-otp-autofill";

const OTP_LENGTH = 6;

function normalizeOtpValue(raw: string): string {
  return raw
    .replace(/[\s-]+/g, "")
    .toUpperCase()
    .slice(0, OTP_LENGTH);
}

type NeonOtpInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  "data-testid"?: string;
};

export function NeonOtpInput({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  "data-testid": dataTestId,
}: NeonOtpInputProps) {
  const inputRef = useRef<React.ComponentRef<typeof InputOTP>>(null);
  const { requestFromSms } = useWebOtpAutofill({
    enabled: !disabled,
    onCode: (raw) => onChange(normalizeOtpValue(raw)),
  });

  useEffect(() => {
    if (disabled) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [disabled]);

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label className="text-foreground text-small font-medium">
          {label}
          {required ? (
            <span aria-hidden="true" className="text-danger ml-0.5">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <InputOTP
        ref={inputRef}
        autoComplete="one-time-code"
        data-testid={dataTestId}
        disabled={disabled}
        inputMode="text"
        maxLength={OTP_LENGTH}
        value={value}
        onChange={(next) => onChange(normalizeOtpValue(next))}
        onFocus={requestFromSms}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
