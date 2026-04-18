/**
 * 调用云函数 `entry`（需在「云开发」中上传并部署该云函数）
 */

// #ifdef MP-WEIXIN
import { useUserStore } from "@/stores/user";

const PUBLIC_ACTIONS = new Set([
  "wxQuickLogin",
  "passwordRegister",
  "passwordLogin",
  "resetPasswordByWechat",
]);

function normalizeEntryPayload(payload = {}) {
  const basePayload = { ...payload };
  // 兼容旧调用：{ action, data: {...} } -> 展开为顶层字段。
  if (basePayload && typeof basePayload.data === "object" && basePayload.data !== null) {
    Object.assign(basePayload, basePayload.data);
    delete basePayload.data;
  }

  const action = String(basePayload.action || "").trim();
  // 受保护 action 自动补 session_token，减少页面重复传参与漏传风险。
  if (!PUBLIC_ACTIONS.has(action) && !basePayload.session_token) {
    const userStore = useUserStore();
    const token = String(userStore.sessionToken || "").trim();
    if (token) {
      basePayload.session_token = token;
    }
  }
  return basePayload;
}

/**
 * @param {Record<string, unknown>} [data]
 */
export async function callEntryCloud(data = {}) {
  const payload = normalizeEntryPayload(data);
  
  try {
    const res = await wx.cloud.callFunction({
      name: "entry",
      data: payload,
    });
    
    // 统一处理 401 未授权错误
    const result = res?.result;
    if (result && result.code === 40101) {
      // token 失效，清除本地登录状态
      const userStore = useUserStore();
      userStore.clearAuth();
      
      // 提示用户并跳转登录
      uni.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none'
      });
      
      // 延迟跳转，让用户看到提示
      // setTimeout(() => {
      //   uni.reLaunch({
      //     url: '/pages/index/index'
      //   });
      // }, 1500);
    }
    
    return res;
  } catch (error) {
    console.error('[callEntryCloud] 调用失败:', error);
    throw error;
  }
}

/**
 * 获取学习页待学习词（默认四级 20 词）
 * @param {{ bookId?: string; count?: number }} [params]
 */
export async function getLearnWords(params = {}) {
  const { bookId = "cet4", count = 20 } = params;
  const res = await callEntryCloud({
    action: "getLearnWords",
    book_id: bookId,
    count,
  });
  return res?.result;
}
// #endif

// #ifndef MP-WEIXIN
export function callEntryCloud() {
  return Promise.reject(new Error("callEntryCloud 仅支持微信小程序"));
}

export function getLearnWords() {
  return Promise.reject(new Error("getLearnWords 仅支持微信小程序"));
}
// #endif
