import { IAuth } from "@/src/lib/shared/types/auth.type";
import { API_URL, PUBLIC_API_URL } from "@/src/lib/shared/constants";
import {
  IOAuthAccounts,
  IOAuthProvider,
  IResendEmailCodeResponse,
  ITwoFactorAppSetupResponse,
  ITwoFactorConfirmResponse,
  ITwoFactorEmailSetupResponse,
  ITwoFactorRequiredResponse,
  ITwoFactorStatus,
  ILoginSuccessResponse,
} from "@mooncellar/schemas";
import agent from "./agent.api";

const AUTH_URL = `${API_URL}/auth`;

const signup = (signUpDto: IAuth) => {
  return agent.post<{ userId: string; email: string }>(
    `${AUTH_URL}/signup`,
    signUpDto
  );
};

const verifyEmail = (data: { email: string; code: string }) => {
  return agent.post<{ userId: string }>(`${AUTH_URL}/verify-email`, data);
};

const resendEmailCode = (email: string) => {
  return agent.post<IResendEmailCodeResponse>(`${AUTH_URL}/verify-email/resend`, {
    email,
  });
};

const login = (loginDto: Omit<IAuth, "userName">) => {
  return agent.post<ILoginSuccessResponse | ITwoFactorRequiredResponse>(
    `${AUTH_URL}/login`,
    loginDto
  );
};

const verifyTwoFactor = (data: { email: string; code: string }) => {
  return agent.post<{ userId: string }>(`${AUTH_URL}/two-factor`, data);
};

const getTwoFactor = () => {
  return agent.get<ITwoFactorStatus>(`${AUTH_URL}/two-factor`);
};

const setupTwoFactor = (method: "email" | "app") => {
  return agent.post<ITwoFactorAppSetupResponse | ITwoFactorEmailSetupResponse>(
    `${AUTH_URL}/two-factor/setup`,
    { method }
  );
};

const confirmTwoFactor = (code: string) => {
  return agent.post<ITwoFactorConfirmResponse>(`${AUTH_URL}/two-factor/confirm`, {
    code,
  });
};

const requestDisableTwoFactor = () => {
  return agent.post<{ method: "email" | "app" }>(
    `${AUTH_URL}/two-factor/disable/request`
  );
};

const disableTwoFactor = (code: string) => {
  return agent.post<{ method: "off" }>(`${AUTH_URL}/two-factor/disable`, {
    code,
  });
};

const getOAuthAccounts = () => {
  return agent.get<IOAuthAccounts>(`${AUTH_URL}/oauth`);
};

const unlinkOAuth = (provider: IOAuthProvider) => {
  return agent.delete<IOAuthAccounts>(`${AUTH_URL}/oauth/${provider}`);
};

const getOAuthStartUrl = (
  provider: IOAuthProvider,
  { link }: { link?: boolean } = {}
) => `${PUBLIC_API_URL}/auth/oauth/${provider}${link ? "?link=1" : ""}`;

const verifyTwoFactorTicket = (data: { ticket: string; code: string }) => {
  return agent.post<{ userId: string }>(
    `${AUTH_URL}/two-factor/ticket`,
    data
  );
};

const addEmail = (email: string) => {
  return agent.post<{ email: string; resendInSeconds: number }>(
    `${AUTH_URL}/email`,
    { email }
  );
};

const confirmAddedEmail = (code: string) => {
  return agent.post<{ email: string }>(`${AUTH_URL}/email/confirm`, { code });
};

const logout = (userId: string) => {
  return agent.post<{ message: string }>(`${AUTH_URL}/${userId}/logout`);
};

const refreshToken = () => {
  return agent.post<{ userId: string }>(`${AUTH_URL}/refresh-token`);
};

export const authAPI = {
  signup,
  getOAuthAccounts,
  unlinkOAuth,
  getOAuthStartUrl,
  verifyTwoFactorTicket,
  addEmail,
  confirmAddedEmail,
  verifyEmail,
  resendEmailCode,
  login,
  verifyTwoFactor,
  getTwoFactor,
  setupTwoFactor,
  confirmTwoFactor,
  requestDisableTwoFactor,
  disableTwoFactor,
  logout,
  refreshToken,
};
