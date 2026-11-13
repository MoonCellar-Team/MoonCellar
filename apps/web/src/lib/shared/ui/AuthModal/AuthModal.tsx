import { AUTH_MODAL_ID } from "@/src/lib/shared/constants";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Input } from "@/src/lib/shared/ui/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { ChangeEvent, FC, useState } from "react";
import { Resolver, SubmitHandler, useForm } from "react-hook-form";
import { useAuth } from "@/src/lib/shared/hooks/auth";
import { authAPI } from "@/src/lib/shared/api";
import {
  OAUTH_PROVIDER_LABELS,
  OAUTH_PROVIDERS,
} from "@/src/lib/shared/constants";
import { Background } from "../Background";
import { useMinimumLoading } from "@/src/lib/shared/hooks/useMinimumLoading";
import { modal } from "../Modal";
import { SvgClose } from "../svg";
import styles from "./AuthModal.module.scss";
import { AuthSchema, createAuthSchema } from "./auth.schema";

const getErrorMessage = (error: unknown, fallback: string) => {
  const message = isAxiosError(error)
    ? error.response?.data?.message
    : undefined;

  if (Array.isArray(message)) return message.join(", ");

  return typeof message === "string" ? message : fallback;
};

interface IAuthModalProps {
  isSignIn?: boolean;
  isPage?: boolean;
  initialStep?: TStep;
  initialEmail?: string;
  initialTwoFactorMethod?: "email" | "app";
  twoFactorTicket?: string;
}

type TStep = "form" | "verify-email" | "two-factor";

export const openAuthModal = (props: IAuthModalProps = {}) =>
  modal.open(<AuthModal {...props} />, { id: AUTH_MODAL_ID });

export const AuthModal: FC<IAuthModalProps> = ({
  isSignIn = false,
  isPage = false,
  initialStep = "form",
  initialEmail = "",
  initialTwoFactorMethod = "email",
  twoFactorTicket,
}) => {
  const {
    login,
    signup,
    verifyEmail,
    verifyTwoFactor,
    verifyTwoFactorTicket,
    resendEmailCode,
  } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(!isSignIn && !isPage);
  const [step, setStep] = useState<TStep>(initialStep);
  const [pendingEmail, setPendingEmail] = useState(initialEmail);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "app">(
    initialTwoFactorMethod
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  const isLoaderShown = useMinimumLoading(isLoading);
  const isCodeLoaderShown = useMinimumLoading(isCodeLoading);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    clearErrors,
    setValue,
  } = useForm<AuthSchema>({
    resolver: (async (values, context, options) => {
      return zodResolver(createAuthSchema(isRegister))(
        values,
        context,
        options
      );
    }) as Resolver<AuthSchema>,
    mode: "onBlur",
  });

  const switchMode = (registerMode: boolean) => {
    setIsRegister(registerMode);
    setError(null);
    clearErrors();
    reset();
  };

  const backToForm = () => {
    setStep("form");
    setError(null);
    setNotice(null);
    setCode("");
  };

  const onSubmit = (e: ChangeEvent<HTMLFormElement>) => {
    new FormData(e.currentTarget).forEach((value, key) =>
      setValue(key as keyof AuthSchema, String(value))
    );
    return handleSubmit(isRegister ? handleSignUp : handleLogin)(e);
  };

  const handleLogin: SubmitHandler<AuthSchema> = (data) => {
    setError(null);
    setIsLoading(true);

    login({
      email: data.email,
      password: data.password,
    })
      .then((result) => {
        if (result && "twoFactorRequired" in result) {
          setPendingEmail(data.email);
          setTwoFactorMethod(result.method);
          setCode("");
          setStep("two-factor");
        }
      })
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 403) {
          setPendingEmail(data.email);
          setCode("");
          setStep("verify-email");
          setError(
            "Confirm your email first. Enter the code from your inbox, or resend it."
          );
          return;
        }
        setError(getErrorMessage(err, "Sign in failed"));
      })
      .finally(() => setIsLoading(false));
  };

  const handleSignUp: SubmitHandler<AuthSchema> = (data) => {
    if (!data.userName) return;

    setError(null);
    setIsLoading(true);

    signup({
      userName: data.userName,
      email: data.email,
      password: data.password,
    })
      .then((result) => {
        setPendingEmail(result.email);
        setCode("");
        setStep("verify-email");
      })
      .catch((err) => {
        setError(getErrorMessage(err, "Sign up failed"));
      })
      .finally(() => setIsLoading(false));
  };

  const submitCode = () => {
    setError(null);
    setNotice(null);
    setIsCodeLoading(true);

    const verify =
      step === "verify-email"
        ? verifyEmail({ email: pendingEmail, code })
        : twoFactorTicket
          ? verifyTwoFactorTicket({ ticket: twoFactorTicket, code })
          : verifyTwoFactor({ email: pendingEmail, code });

    verify
      .catch((err) => {
        setError(
          getErrorMessage(
            err,
            step === "verify-email" ? "Verification failed" : "Sign in failed"
          )
        );
      })
      .finally(() => setIsCodeLoading(false));
  };

  const handleResend = () => {
    setError(null);
    setNotice(null);
    setIsCodeLoading(true);

    resendEmailCode(pendingEmail)
      .then(() => setNotice("A new code was sent to your email"))
      .catch((err) => setError(getErrorMessage(err, "Could not send the code")))
      .finally(() => setIsCodeLoading(false));
  };

  const codeHeading =
    step === "verify-email"
      ? "Confirm your email"
      : twoFactorMethod === "app"
        ? "Two-factor sign-in"
        : "Two-factor sign-in";

  const codeLabel =
    step === "verify-email"
      ? "Verification code"
      : twoFactorMethod === "app"
        ? "Authenticator or backup code"
        : "Sign-in code";

  const codeHint =
    step === "verify-email"
      ? `Enter the 6-digit code sent to ${pendingEmail}.`
      : twoFactorMethod === "app"
        ? "Enter the code from your authenticator app, or a backup code."
        : twoFactorTicket
          ? "Enter the code sent to the email address of your account."
          : `Enter the code sent to ${pendingEmail}.`;

  const form = (
    <form
      onSubmit={onSubmit}
      className={isPage ? styles.page : styles.content}
      autoComplete="on"
    >
      <div className={styles.content__inputs}>
        {isRegister && (
          <div>
            <label>User Name</label>
            <Input
              type="text"
              {...register("userName")}
              error={errors.userName}
            />
          </div>
        )}
        <div>
          <label>Email</label>
          <Input
            type="email"
            id="email"
            autoComplete="username"
            {...register("email")}
            error={errors.email}
          />
        </div>
        <div>
          <label>Password</label>
          <Input
            type="password"
            id="password"
            autoComplete="current-password"
            {...register("password")}
            error={errors.password}
          />
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.content__buttons}>
        <Button
          color={ButtonColor.ACCENT}
          className={styles.btn}
          type="submit"
          isLoading={isLoaderShown}
        >
          {isRegister ? "Sign up" : "Sign in"}
        </Button>
        {!isPage && (
          <p className={styles.switch}>
            {isRegister ? "Already have an account?" : "Don't have an account?"}
            <Button
              type="button"
              color={ButtonColor.TRANSPARENT}
              className={styles.link}
              compact
              onClick={() => switchMode(!isRegister)}
            >
              {isRegister ? "Sign in" : "Sign up"}
            </Button>
          </p>
        )}
      </div>
      {!isPage && (
        <div className={styles.providers}>
          <span className={styles.providers__label}>or continue with</span>
          <div className={styles.providers__buttons}>
            {OAUTH_PROVIDERS.map((provider) => (
              <Button
                key={provider}
                href={authAPI.getOAuthStartUrl(provider)}
                color={ButtonColor.DEFAULT}
                aria-label={`Continue with ${OAUTH_PROVIDER_LABELS[provider]}`}
              >
                {OAUTH_PROVIDER_LABELS[provider]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );

  const codeStep = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitCode();
      }}
      className={isPage ? styles.page : styles.content}
    >
      <h3 className={styles.codeHeading}>{codeHeading}</h3>
      <p className={styles.codeHint}>{codeHint}</p>
      <div className={styles.content__inputs}>
        <div>
          <label>{codeLabel}</label>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>
      </div>
      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.content__buttons}>
        <Button
          color={ButtonColor.ACCENT}
          className={styles.btn}
          type="submit"
          isLoading={isCodeLoaderShown}
          disabled={!code}
        >
          Confirm
        </Button>
        {step === "verify-email" && (
          <Button
            type="button"
            color={ButtonColor.TRANSPARENT}
            className={styles.link}
            compact
            onClick={handleResend}
          >
            Resend code
          </Button>
        )}
        <Button
          type="button"
          color={ButtonColor.TRANSPARENT}
          className={styles.link}
          compact
          onClick={backToForm}
        >
          Back
        </Button>
      </div>
    </form>
  );

  const content = step === "form" ? form : codeStep;

  if (isPage) return content;

  return (
    <div className={styles.container}>
      {content}
      <Button
        type="button"
        color={ButtonColor.TRANSPARENT}
        className={styles.close}
        tooltip="Close"
        tooltipAlign="right"
        onClick={() => modal.close(AUTH_MODAL_ID)}
      >
        <SvgClose size="20" />
      </Button>
      <Background />
    </div>
  );
};
