import { computed, ref } from "vue";
import { defineStore } from "pinia";

export const useUserStore = defineStore(
  "user",
  () => {
    // 后端下发的会话 token；用于调用需要登录态的云函数 action。
    const sessionToken = ref("");
    // 用户基础信息（后续可用 getAuthProfile 填充）。
    const profile = ref(null);

    // 统一登录态判断：有 token 即视为已登录。
    const isLoggedIn = computed(() => Boolean(sessionToken.value));

    // 对外提供方法式判断，便于业务侧统一调用。
    function checkIsLoggedIn() {
      return Boolean(sessionToken.value);
    }

    function setSessionToken(token) {
      sessionToken.value = String(token || "").trim();
    }

    function setProfile(userProfile) {
      profile.value = userProfile || null;
    }

    // 登录成功后一次性设置会话与用户信息。
    // 支持直接传入后端返回的 result.data（如 { session: { session_token }, user }）。
    function setAuthInfo(payload = {}) {
      const sessionTokenFromPayload =
        payload?.session?.session_token ||
        payload?.sessionToken ||
        payload?.session_token ||
        "";
      const userProfileFromPayload = payload?.user || payload?.profile || null;
      setSessionToken(sessionTokenFromPayload);
      setProfile(userProfileFromPayload);
    }

    function clearAuth() {
      sessionToken.value = "";
      profile.value = null;
    }

    // 退出登录：清空所有认证数据
    function logout() {
      clearAuth();
    }

    return {
      sessionToken,
      profile,
      isLoggedIn,
      checkIsLoggedIn,
      setSessionToken,
      setProfile,
      setAuthInfo,
      clearAuth,
      logout,
    };
  },
  {
    persist: true,
  },
);
