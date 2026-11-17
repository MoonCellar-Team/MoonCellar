"use client";

import { FC } from "react";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import styles from "./StreamCode.module.scss";

interface IStreamCodeProps {
  code: string;
  label?: string;
  className?: string;
}

export const StreamCode: FC<IStreamCodeProps> = ({
  code,
  label = "Stream code",
  className,
}) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success({ description: "Stream code copied" });
    } catch {
      toast.error({
        description: "Could not copy the code. Select it instead.",
      });
    }
  };

  return (
    <div className={className}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <Button color={ButtonColor.DEFAULT} onClick={copy} tooltip="Copy code">
          Copy
        </Button>
      </div>
      <div
        className={styles.code}
        aria-label={`${label}: ${code.split("").join(" ")}`}
        aria-live="polite"
      >
        {code.split("").map((character, index) => (
          <span key={`${character}-${index}`} className={styles.code__char}>
            {character}
          </span>
        ))}
      </div>
    </div>
  );
};
