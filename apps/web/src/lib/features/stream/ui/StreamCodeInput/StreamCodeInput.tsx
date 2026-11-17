"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
  useRef,
} from "react";
import { STREAM_CODE_LENGTH, normalizeStreamCode } from "@mooncellar/schemas";
import classNames from "classnames";
import styles from "./StreamCodeInput.module.scss";

interface IStreamCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  isDisabled?: boolean;
  label?: string;
  error?: string;
  autoFocus?: boolean;
}

export const StreamCodeInput: FC<IStreamCodeInputProps> = ({
  value,
  onChange,
  onSubmit,
  isDisabled,
  label = "Six-character stream code",
  error,
  autoFocus,
}) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const characters = Array.from(
    { length: STREAM_CODE_LENGTH },
    (_, index) => value[index] ?? ""
  );

  const focus = (index: number) => {
    inputs.current[
      Math.max(0, Math.min(STREAM_CODE_LENGTH - 1, index))
    ]?.focus();
  };

  const put = (index: number, character: string) => {
    const next = [...characters];
    next[index] = character;
    onChange(next.join("").trimEnd());
    if (character) focus(index + 1);
  };

  const change = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const character = event.target.value
      .slice(-1)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!character) {
      put(index, "");
      return;
    }
    put(index, character);
  };

  const keyDown =
    (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && !characters[index]) {
        event.preventDefault();
        focus(index - 1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focus(index - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        focus(index + 1);
      }
      if (event.key === "Enter" && onSubmit) {
        event.preventDefault();
        onSubmit();
      }
    };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = normalizeStreamCode(event.clipboardData.getData("text"));
    if (!pasted) return;
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div className={styles.root}>
      <div
        className={classNames(styles.inputs, {
          [styles.inputs_error]: !!error,
        })}
        role="group"
        aria-label={label}
      >
        {characters.map((character, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            className={styles.input}
            value={character}
            onChange={change(index)}
            onKeyDown={keyDown(index)}
            onPaste={paste}
            onFocus={(event) => event.target.select()}
            disabled={isDisabled}
            autoFocus={autoFocus && index === 0}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={1}
            aria-label={`Character ${index + 1} of ${STREAM_CODE_LENGTH}`}
            aria-invalid={!!error || undefined}
          />
        ))}
      </div>
      <span className={styles.help} aria-live="polite">
        {error ?? "The code is on the host's screen."}
      </span>
    </div>
  );
};
