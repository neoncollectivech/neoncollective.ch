import { Alert } from "@heroui/alert";
import clsx from "clsx";

type FormErrorProps = {
  children: React.ReactNode;
  className?: string;
};

export function FormError({ children, className }: FormErrorProps) {
  return (
    <Alert
      className={clsx(
        "rounded-none border border-danger/30 bg-danger/5 py-2",
        className,
      )}
      classNames={{
        base: "items-start",
        description: "text-sm text-danger/90 font-mono",
        mainWrapper: "min-h-0",
      }}
      color="danger"
      description={children}
      icon={null}
      radius="none"
      variant="bordered"
    />
  );
}
