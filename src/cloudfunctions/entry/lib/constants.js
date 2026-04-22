"use strict";

const CODE = {
  OK: 0,
  BAD_REQUEST: 40001,
  INVALID_CREDENTIALS: 40002,
  // 修改密码时旧密码校验失败。
  OLD_PASSWORD_INCORRECT: 40003,
  // 已有密码的账号再次调用 setPassword 时返回该码，避免无旧密码覆盖。
  PASSWORD_ALREADY_SET: 40004,
  UNAUTHORIZED: 40101,
  USER_NOT_FOUND: 40401,
  WECHAT_ALREADY_BOUND: 40901,
  USERNAME_ALREADY_EXISTS: 40902,
  // 学习会话相关错误码
  SESSION_NOT_FOUND: 40402,
  SESSION_CONFLICT: 40903,
  STAGE_INVALID: 40904,
  WORD_NOT_IN_SESSION: 40403,
  INTERNAL_ERROR: 50001,
};

const MESSAGE = {
  OK: "ok",
  BAD_REQUEST: "参数错误",
  INVALID_CREDENTIALS: "用户名或密码错误",
  OLD_PASSWORD_INCORRECT: "旧密码错误",
  PASSWORD_ALREADY_SET: "已设置登录密码，请使用修改密码",
  UNAUTHORIZED: "请先登录",
  USER_NOT_FOUND: "用户不存在",
  WECHAT_ALREADY_BOUND: "当前微信已绑定其他账号",
  USERNAME_ALREADY_EXISTS: "用户名已存在",
  // 学习会话相关错误消息
  SESSION_NOT_FOUND: "会话不存在",
  SESSION_CONFLICT: "会话已结束或状态异常",
  STAGE_INVALID: "当前阶段不允许此操作",
  WORD_NOT_IN_SESSION: "单词不属于当前会话",
  INTERNAL_ERROR: "服务异常",
};

module.exports = {
  CODE,
  MESSAGE,
};
