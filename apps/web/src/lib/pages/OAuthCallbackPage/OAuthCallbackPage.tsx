"use client";

import { FC, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IOAuthProvider } from "@mooncellar/schemas";
import { useAuth } from "@/src/lib/shared/hooks/auth";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { OAUTH_PROVIDER_LABELS } from "@/src/lib/shared/constants";
import { AuthModal, openAuthModal } from "@/src/lib/shared/ui/AuthModal";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import styles from "./OAuthCallbackPage.module.scss";

const getProviderLabel = (provider: string | null): string =>
  provider && provider in OAUTH_PROVIDER_LABELS
    ? OAUTH_PROVIDER_LABELS[provider as IOAuthProvider]
    : "That provider";

const getErrorMessage = (error: string | null, provider: string): string => {
  switch (error) {
    case "cancelled":
      return `${provider} sign-in was cancelled.`;
    case "provider-unavailable":
      return `${provider} sign-in is not set up on this server yet.`;
    case "link-taken":
      return `That ${provider} account is already linked to another MoonCellar account.`;
    case "account-unverified":
      return "An account with this email address exists but is not confirmed. Confirm it from your inbox, then link the provider in Settings.";
    case "state-expired":
      return "The sign-in took too long. Start again.";
    default:
      return `${provider} could not sign you in. Try again.`;
  }
};

export const OAuthCallbackPage: FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const { authUpdate } = useAuth();
  const profile = useAuthStore((state) => state.profile);
  const handled = useRef<string | null>(null);
  const isSignedIn = useRef(false);

  const status = params.get("status");
  const providerParam = params.get("provider");
  const provider = getProviderLabel(providerParam);
  const error = params.get("error");
  const userId = params.get("userId");
  const ticket = params.get("ticket");
  const method = params.get("method") === "app" ? "app" : "email";
  const settingsHref = profile ? `/user/${profile.userName}/settings` : "/";

  useEffect(() => {
    if (isSignedIn.current || status !== "signed-in" || !userId) return;

    isSignedIn.current = true;
    authUpdate(userId);
  }, [status, userId, authUpdate]);

  useEffect(() => {
    if (status !== "linked" || handled.current === status) return;

    handled.current = status;
    toast.success({ description: `${provider} is now linked to your account` });
    router.replace(settingsHref);
  }, [status, provider, router, settingsHref]);

  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (!state.profile || state.profile === previous.profile) return;
        router.replace("/");
      }),
    [router]
  );

  if (status === "two-factor" && ticket) {
    return (
      <div className={styles.page}>
        <Box wrapperStyle={{ width: "var(--status-card-width)" }}>
          <div className={styles.card}>
            <h1 className={styles.card__title}>Two-factor sign-in</h1>
            <p className={styles.card__hint}>
              Confirm the last step to finish signing in with {provider}.
            </p>
          </div>
          <AuthModal
            isPage
            isSignIn
            initialStep="two-factor"
            initialTwoFactorMethod={method}
            twoFactorTicket={ticket}
          />
        </Box>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.page}>
        <Box wrapperStyle={{ width: "var(--status-card-width)" }}>
          <div className={styles.card}>
            <h1 className={styles.card__title}>Sign-in failed</h1>
            <p className={styles.card__hint}>
              {getErrorMessage(error, provider)}
            </p>
          </div>
          <div className={styles.actions}>
            <Button
              type="button"
              color={ButtonColor.ACCENT}
              onClick={() => openAuthModal({ isSignIn: true })}
            >
              Try again
            </Button>
            {profile && (
              <Button href={settingsHref} color={ButtonColor.TRANSPARENT}>
                Back to settings
              </Button>
            )}
          </div>
        </Box>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Box wrapperStyle={{ width: "var(--status-card-width)" }}>
        <div className={styles.card} aria-live="polite">
          <h1 className={styles.card__title}>
            {status === "linked" ? `Linking ${provider}…` : "Signing you in…"}
          </h1>
          <p className={styles.card__hint}>This takes a moment.</p>
        </div>
      </Box>
    </div>
  );
};
