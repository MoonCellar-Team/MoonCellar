import { AUTH_MODAL_ID } from "@/src/lib/shared/constants";
import { useRouter } from "next/navigation";
import { authAPI, userAPI } from "@/src/lib/shared/api";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/src/lib/shared/constants";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { IAuth } from "@/src/lib/shared/types/auth.type";
import { modal } from "@/src/lib/shared/ui/Modal";
import { deleteCookie } from "@/src/lib/shared/utils/cookies.utils";
import { unsubscribePush } from "@/src/lib/shared/utils/push.utils";
import { useUserStore } from "@/src/lib/shared/store/user.store";

export const useAuth = () => {
  const { clear, setProfile, setAuth, setIsAdmin } = useAuthStore();
  const { setPlaythroughs } = useUserStore();
  const { push } = useRouter();

  const logout = (id: string, { href }: { href?: string } = {}) => {
    unsubscribePush()
      .then(() => authAPI.logout(id))
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        deleteCookie(ACCESS_TOKEN);
        deleteCookie(REFRESH_TOKEN);
        clear();
        setPlaythroughs(undefined);
        if (href) window.location.assign(href);
        else push("/");
      });
  };
  const authUpdate = (userId: string) => {
    setAuth(true);
    userAPI.getById(userId).then((res) => {
      setProfile(res.data);
      setIsAdmin(!!res.data.roles?.includes("admin"));
      modal.close(AUTH_MODAL_ID);
    });
  };

  const login = async (data: Omit<IAuth, "userName">) => {
    const response = await authAPI.login(data);

    if ("twoFactorRequired" in response.data) {
      return response.data;
    }

    authUpdate(response.data.userId);
    return response.data;
  };

  const signup = async (data: IAuth) => {
    const response = await authAPI.signup(data);
    return response.data;
  };

  const verifyEmail = async (data: { email: string; code: string }) => {
    const response = await authAPI.verifyEmail(data);
    authUpdate(response.data.userId);
    return response.data;
  };

  const verifyTwoFactor = async (data: { email: string; code: string }) => {
    const response = await authAPI.verifyTwoFactor(data);
    authUpdate(response.data.userId);
    return response.data;
  };

  const verifyTwoFactorTicket = async (data: {
    ticket: string;
    code: string;
  }) => {
    const response = await authAPI.verifyTwoFactorTicket(data);
    authUpdate(response.data.userId);
    return response.data;
  };

  const resendEmailCode = async (email: string) => {
    const response = await authAPI.resendEmailCode(email);
    return response.data;
  };

  return {
    logout,
    login,
    signup,
    verifyEmail,
    verifyTwoFactor,
    verifyTwoFactorTicket,
    resendEmailCode,
    authUpdate,
  };
};
