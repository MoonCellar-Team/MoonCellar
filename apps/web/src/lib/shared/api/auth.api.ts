import { IAuth } from "@/src/lib/shared/types/auth.type";
import { API_URL } from "@/src/lib/shared/constants";
import {
  ILoginSuccessResponse,
  IResendEmailCodeResponse,
  ITwoFactorAppSetupResponse,
  ITwoFactorConfirmResponse,
  ITwoFactorEmailSetupResponse,
  ITwoFactorRequiredResponse,
  ITwoFactorStatus,
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

const logout = (userId: string) => {
  return agent.post<{ message: string }>(`${AUTH_URL}/${userId}/logout`);
};

const refreshToken = () => {
  return agent.post<{ userId: string }>(`${AUTH_URL}/refresh-token`);
};

export const authAPI = {
  signup,
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
