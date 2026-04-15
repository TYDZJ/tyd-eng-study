const cloud = require("wx-server-sdk");
const { CODE, MESSAGE } = require("./lib/constants");
const { fail } = require("./lib/response");
const { requireAuth } = require("./lib/auth");
const authHandlers = require("./handlers/auth");
const learnHandlers = require("./handlers/learn");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const actionMap = {
  wxQuickLogin: authHandlers.wxQuickLogin,
  passwordRegister: authHandlers.passwordRegister,
  passwordLogin: authHandlers.passwordLogin,
  setPassword: authHandlers.setPassword,
  resetPasswordByWechat: authHandlers.resetPasswordByWechat,
  getAuthProfile: authHandlers.getAuthProfile,
  logout: authHandlers.logout,
  getLearnWords: learnHandlers.getLearnWords,
};

// 白名单 action：不需要 session_token 也可调用。
const publicActions = new Set([
  "wxQuickLogin",
  "passwordRegister",
  "passwordLogin",
  "resetPasswordByWechat",
]);

/**
 * 云函数统一入口：通过 action 分发并保持统一返回结构
 * @param {object} event 小程序 callFunction 传入 data
 */
exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext();
    const action = String(event.action || "").trim();
    const handler = actionMap[action];

    if (!action || !handler) {
      return fail(CODE.BAD_REQUEST, "未知 action");
    }

    const context = {
      db,
      _,
      event,
      wxContext,
      auth: null,
    };

    if (!publicActions.has(action)) {
      // 受保护 action 统一在入口层鉴权，失败返回 40101 供前端统一处理。
      const authResult = await requireAuth({
        db,
        _,
        event,
      });
      if (!authResult.ok) {
        return fail(authResult.error.code, authResult.error.message);
      }
      context.auth = authResult;
    }

    return await handler(context);
  } catch (error) {
    console.error("[entry] unexpected error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
};
