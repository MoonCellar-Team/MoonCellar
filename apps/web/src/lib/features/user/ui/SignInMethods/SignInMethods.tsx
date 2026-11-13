"use client";

import { FC, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IOAuthProvider } from "@mooncellar/schemas";
import { authAPI, userAPI } from "@/src/lib/shared/api";
import {
  OAUTH_PROVIDER_LABELS,
  OAUTH_PROVIDERS,
} from "@/src/lib/shared/constants";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Input } from "@/src/lib/shared/ui/Input";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import styles from "./SignInMethods.module.scss";

export const SignInMethods: FC = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["oauth-accounts"],
    queryFn: () => authAPI.getOAuthAccounts().then(({ data }) => data),
  });

  const refreshAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ["oauth-accounts"] });

  const unlinkMutation = useMutation({
    mutationFn: (provider: IOAuthProvider) =>
      authAPI.unlinkOAuth(provider).then(({ data }) => data),
    onSuccess: (data, provider) => {
      queryClient.setQueryData(["oauth-accounts"], data);
      toast.success({
        description: `${OAUTH_PROVIDER_LABELS[provider]} is no longer linked`,
      });
    },
  });

  const addEmailMutation = useMutation({
    mutationFn: (address: string) => authAPI.addEmail(address),
    onSuccess: (_response, address) => {
      setIsCodeSent(true);
      setCode("");
      toast.success({ description: `A code was sent to ${address}` });
    },
  });

  const confirmEmailMutation = useMutation({
    mutationFn: (value: string) => authAPI.confirmAddedEmail(value),
    onSuccess: async () => {
      setIsCodeSent(false);
      setCode("");
      setEmail("");
      await refreshAccounts();

      if (profile) {
        const { data } = await userAPI.getById(profile._id);
        setProfile(data);
      }

      toast.success({ description: "Email address confirmed" });
    },
  });

  if (!accounts) return null;

  const isLastWay = accounts.linked.length + (accounts.hasPassword ? 1 : 0) <= 1;
  const linkedProviders = accounts.linked.map((link) => link.provider);
  const isBusy = unlinkMutation.isPending || addEmailMutation.isPending;

  return (
    <div className={styles.block}>
      <p className={styles.note}>
        Sign in with a provider account instead of your password. The last way
        you sign in cannot be removed.
      </p>

      <ul className={styles.list}>
        {OAUTH_PROVIDERS.map((provider) => {
          const isLinked = linkedProviders.includes(provider);
          const isAvailable = accounts.providers.includes(provider);

          return (
            <li key={provider} className={styles.row}>
              <span className={styles.row__name}>
                {OAUTH_PROVIDER_LABELS[provider]}
                {isLinked && <span className={styles.row__state}>Linked</span>}
              </span>
              {!isAvailable ? (
                <span className={styles.row__hint}>
                  Not set up on this server yet
                </span>
              ) : isLinked ? (
                <Button
                  type="button"
                  color={ButtonColor.RED}
                  compact
                  disabled={isBusy || isLastWay}
                  tooltip={
                    isLastWay
                      ? "This is the only way you sign in. Link another way first."
                      : undefined
                  }
                  onClick={() => unlinkMutation.mutate(provider)}
                >
                  Unlink
                </Button>
              ) : (
                <Button
                  href={authAPI.getOAuthStartUrl(provider, { link: true })}
                  color={ButtonColor.DEFAULT}
                  compact
                >
                  Link
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!accounts.email && (
        <div className={styles.email}>
          <p className={styles.note}>
            Your account has no email address. Add one to receive sign-in codes
            and account notices.
          </p>
          {isCodeSent ? (
            <div className={styles.email__fields}>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code from the letter"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !code) return;
                  event.preventDefault();
                  confirmEmailMutation.mutate(code);
                }}
                maxLength={6}
              />
              <Button
                type="button"
                color={ButtonColor.ACCENT}
                disabled={!code || confirmEmailMutation.isPending}
                onClick={() => confirmEmailMutation.mutate(code)}
              >
                Confirm
              </Button>
            </div>
          ) : (
            <div className={styles.email__fields}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !email) return;
                  event.preventDefault();
                  addEmailMutation.mutate(email);
                }}
              />
              <Button
                type="button"
                color={ButtonColor.DEFAULT}
                disabled={!email || isBusy}
                onClick={() => addEmailMutation.mutate(email)}
              >
                Add email
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
