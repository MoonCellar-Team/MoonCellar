import { FC, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authAPI } from "@/src/lib/shared/api";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Input } from "@/src/lib/shared/ui/Input";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import { QRCodeSVG } from "qrcode.react";
import styles from "./TwoFactorSettings.module.scss";

type TMethod = "off" | "email" | "app";

export const TwoFactorSettings: FC = () => {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["two-factor"],
    queryFn: () => authAPI.getTwoFactor().then(({ data }) => data),
  });

  const method: TMethod = status?.method ?? "off";

  const [pending, setPending] = useState<"email" | "app" | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["two-factor"] });

  const setupMutation = useMutation({
    mutationFn: (nextMethod: "email" | "app") =>
      authAPI.setupTwoFactor(nextMethod).then(({ data }) => data),
    onSuccess: (data) => {
      if ("otpauthUri" in data) {
        setSecret(data.secret);
        setOtpauthUri(data.otpauthUri);
        setBackupCodes(null);
        setPending("app");
      } else {
        setSecret(null);
        setOtpauthUri(null);
        setBackupCodes(null);
        setPending("email");
      }
      setCode("");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (enteredCode: string) =>
      authAPI.confirmTwoFactor(enteredCode).then(({ data }) => data),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes ?? null);
      setPending(null);
      setSecret(null);
      setOtpauthUri(null);
      setCode("");
      invalidate();
      toast.success({
        description:
          data.method === "app"
            ? "Two-factor sign-in with the authenticator app is enabled"
            : "Two-factor sign-in with email codes is enabled",
      });
    },
  });

  const disableRequestMutation = useMutation({
    mutationFn: () =>
      authAPI.requestDisableTwoFactor().then(({ data }) => data),
    onSuccess: () => {
      setIsDisabling(true);
      setCode("");
    },
  });

  const disableMutation = useMutation({
    mutationFn: (enteredCode: string) =>
      authAPI.disableTwoFactor(enteredCode).then(({ data }) => data),
    onSuccess: () => {
      setIsDisabling(false);
      setPending(null);
      setCode("");
      invalidate();
      toast.success({ description: "Two-factor sign-in is turned off" });
    },
  });

  const busy =
    setupMutation.isPending ||
    confirmMutation.isPending ||
    disableRequestMutation.isPending ||
    disableMutation.isPending;

  const startEmail = () => setupMutation.mutate("email");
  const startApp = () => setupMutation.mutate("app");
  const confirmCode = () => confirmMutation.mutate(code);
  const startDisable = () => disableRequestMutation.mutate();
  const confirmDisable = () => disableMutation.mutate(code);

  if (backupCodes) {
    return (
      <div className={styles.block}>
        <p className={styles.note}>
          Two-factor sign-in is enabled. Save these backup codes somewhere safe —
          each works once if you lose your authenticator.
        </p>
        <ul className={styles.backupCodes}>
          {backupCodes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
        <Button type="button" color={ButtonColor.ACCENT} onClick={() => setBackupCodes(null)}>
          Done
        </Button>
      </div>
    );
  }

  if (pending === "app" && otpauthUri && secret) {
    return (
      <div className={styles.block}>
        <p className={styles.note}>
          Scan this code with your authenticator app, then enter the 6-digit code
          it shows.
        </p>
        <div className={styles.qr}>
          <QRCodeSVG value={otpauthUri} size={180} />
        </div>
        <p className={styles.secret}>
          Or enter the secret manually: <span>{secret}</span>
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          className={styles.input}
        />
        <div className={styles.actions}>
          <Button
            type="button"
            color={ButtonColor.ACCENT}
            onClick={confirmCode}
            disabled={!code || busy}
            isLoading={confirmMutation.isPending}
          >
            Confirm
          </Button>
          <Button
            type="button"
            color={ButtonColor.TRANSPARENT}
            onClick={() => setPending(null)}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (pending === "email" || isDisabling) {
    const isEmailMethod = method === "email";
    const isAppDisable = isDisabling && !isEmailMethod;
    return (
      <div className={styles.block}>
        <p className={styles.note}>
          {isAppDisable
            ? "Enter a code from your authenticator app, or a backup code, to turn two-factor sign-in off."
            : isDisabling
              ? "We sent a code to your email. Enter it to turn two-factor sign-in off."
              : "We sent a code to your email. Enter it to confirm."}
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={isAppDisable ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={isAppDisable ? 20 : 6}
          placeholder={isAppDisable ? "Authenticator or backup code" : "6-digit code"}
          className={styles.input}
        />
        <div className={styles.actions}>
          <Button
            type="button"
            color={isDisabling ? ButtonColor.RED : ButtonColor.ACCENT}
            onClick={isDisabling ? confirmDisable : confirmCode}
            disabled={!code || busy}
            isLoading={
              (isDisabling ? disableMutation : confirmMutation).isPending
            }
          >
            {isDisabling ? "Turn off" : "Confirm"}
          </Button>
          <Button
            type="button"
            color={ButtonColor.TRANSPARENT}
            onClick={() => {
              setPending(null);
              setIsDisabling(false);
              setCode("");
            }}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (method === "off") {
    return (
      <div className={styles.block}>
        <p className={styles.note}>
          Require a code from your email or an authenticator app every time you
          sign in.
        </p>
        <div className={styles.actions}>
          <Button
            type="button"
            color={ButtonColor.ACCENT}
            onClick={startEmail}
            disabled={busy}
            isLoading={setupMutation.isPending}
          >
            Use email codes
          </Button>
          <Button
            type="button"
            color={ButtonColor.ACCENT}
            onClick={startApp}
            disabled={busy}
            isLoading={setupMutation.isPending}
          >
            Use authenticator app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.block}>
      <p className={styles.note}>
        Two-factor sign-in is on with{" "}
        {method === "app" ? "an authenticator app" : "email codes"}.
      </p>
      <Button
        type="button"
        color={ButtonColor.RED}
        onClick={startDisable}
        disabled={busy}
        isLoading={disableRequestMutation.isPending}
      >
        Turn off
      </Button>
    </div>
  );
};
