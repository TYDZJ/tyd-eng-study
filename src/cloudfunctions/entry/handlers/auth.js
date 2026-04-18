"use strict";

const { CODE, MESSAGE } = require("../lib/constants");
const { ok, fail } = require("../lib/response");
const { hashPassword, verifyPassword } = require("../lib/password");
const { createSession, makeUserId } = require("../lib/session");
const { getUserByUserId } = require("../lib/auth");

function sanitizeUser(user) {
  return {
    user_id: user.user_id,
    username: user.username || "",
    nickname: user.nickname || user.username || "", // 优先使用nickname，如果没有则回退到username
    user_type: user.user_type || "guest",
    created_at: user.created_at || null,
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function assertPassword(value) {
  const password = String(value || "");
  return password.length >= 6 && password.length <= 64;
}

function pickEventField(event, keys = []) {
  const payload = event && typeof event === "object" ? event : {};
  const nestedData =
    payload.data && typeof payload.data === "object" ? payload.data : {};
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      return payload[key];
    }
    if (nestedData[key] !== undefined && nestedData[key] !== null) {
      return nestedData[key];
    }
  }
  return "";
}

async function getBindingByOpenId(db, openid) {
  const res = await db
    .collection("wx_bindings")
    .where({
      openid,
    })
    .limit(1)
    .get();
  return (res.data || [])[0] || null;
}

async function getUserByUsername(db, username) {
  const res = await db
    .collection("users")
    .where({
      username,
    })
    .limit(1)
    .get();
  return (res.data || [])[0] || null;
}

async function createUser(db, payload) {
  const now = new Date();
  const userId = makeUserId();
  const data = {
    user_id: userId,
    username: payload.username || "", // 账户名，唯一且不可重复
    nickname: payload.nickname || payload.username || "", // 昵称，可重复，默认为username
    password_hash: payload.passwordHash || "",
    user_type: payload.userType || "guest",
    created_at: now,
    updated_at: now,
  };
  await db.collection("users").add({ data });
  return data;
}

async function bindOpenId(db, openid, userId) {
  const now = new Date();
  await db.collection("wx_bindings").add({
    data: {
      openid,
      user_id: userId,
      created_at: now,
      updated_at: now,
    },
  });
}

async function wxQuickLogin({ db, wxContext }) {
  const openid = String(wxContext.OPENID || "").trim();
  if (!openid) {
    return fail(CODE.UNAUTHORIZED, MESSAGE.UNAUTHORIZED);
  }

  let binding = await getBindingByOpenId(db, openid);
  let user = null;

  if (binding) {
    user = await getUserByUserId(db, binding.user_id);
  } else {
    // 首次微信登录：创建 guest 用户并绑定当前 openid。
    user = await createUser(db, {
      userType: "guest",
    });
    await bindOpenId(db, openid, user.user_id);
    binding = {
      openid,
      user_id: user.user_id,
    };
  }

  if (!user) {
    return fail(CODE.USER_NOT_FOUND, MESSAGE.USER_NOT_FOUND);
  }

  const session = await createSession(db, {
    userId: user.user_id,
    openid,
    loginType: "wechat",
  });

  return ok({
    user: sanitizeUser(user),
    binding,
    session,
  });
}

async function passwordRegister({ db, event, wxContext }) {
  const openid = String(wxContext.OPENID || "").trim();
  const rawUsername = pickEventField(event, ["username"]);
  const username = normalizeUsername(rawUsername);
  const password = String(pickEventField(event, ["password"]));

  if (!openid || !username || !assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  // 验证账号名称格式：只能包含字母、数字、下划线，长度6-20位
  const usernameRegex = /^[a-zA-Z0-9_]{6,20}$/;
  if (!usernameRegex.test(username)) {
    return fail(CODE.BAD_REQUEST, "账号名称只能包含字母、数字、下划线，长度6-20位");
  }

  const bound = await getBindingByOpenId(db, openid);
  if (bound) {
    // 业务规则：一个微信号只能绑定一个账号。
    return fail(CODE.WECHAT_ALREADY_BOUND, MESSAGE.WECHAT_ALREADY_BOUND);
  }

  const userByName = await getUserByUsername(db, username);
  if (userByName) {
    return fail(CODE.USERNAME_ALREADY_EXISTS, MESSAGE.USERNAME_ALREADY_EXISTS);
  }

  const user = await createUser(db, {
    username,
    passwordHash: hashPassword(password),
    userType: "account",
  });
  await bindOpenId(db, openid, user.user_id);

  const session = await createSession(db, {
    userId: user.user_id,
    openid,
    loginType: "password_register",
  });

  return ok({
    user: sanitizeUser(user),
    session,
    binding: {
      openid,
      user_id: user.user_id,
    },
  });
}

async function passwordLogin({ db, event }) {
  const username = normalizeUsername(pickEventField(event, ["username"]));
  const password = String(pickEventField(event, ["password"]));
  if (!username || !password) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  const user = await getUserByUsername(db, username);
  if (!user || !user.password_hash) {
    return fail(CODE.INVALID_CREDENTIALS, MESSAGE.INVALID_CREDENTIALS);
  }
  if (!verifyPassword(password, user.password_hash)) {
    return fail(CODE.INVALID_CREDENTIALS, MESSAGE.INVALID_CREDENTIALS);
  }

  const session = await createSession(db, {
    userId: user.user_id,
    // 用户名密码登录不依赖当前微信身份，openid 置空即可。
    openid: "",
    loginType: "password",
  });

  return ok({
    user: sanitizeUser(user),
    session,
  });
}

async function setPassword({ db, auth, event }) {
  const password = String(pickEventField(event, ["password", "new_password", "newPassword"]));
  if (!assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }
  // setPassword 仅用于"首次设置密码"，已有密码必须走 changePassword。
  if (auth.user.password_hash) {
    return fail(CODE.PASSWORD_ALREADY_SET, MESSAGE.PASSWORD_ALREADY_SET);
  }

  await db
    .collection("users")
    .where({
      user_id: auth.user.user_id,
    })
    .update({
      data: {
        password_hash: hashPassword(password),
        user_type: "account", // 设置密码后，将用户类型改为 account
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: auth.user.user_id,
    changed: true,
    has_password: true,
    user_type: "account",
  });
}

async function changePassword({ db, auth, event }) {
  const oldPassword = String(
    pickEventField(event, ["old_password", "oldPassword"])
  );
  const newPassword = String(
    pickEventField(event, ["new_password", "newPassword", "password"])
  );
  if (!oldPassword || !assertPassword(newPassword)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }
  if (!auth.user.password_hash) {
    return fail(CODE.BAD_REQUEST, "请先设置密码");
  }
  // 修改密码必须先验旧密码，防止拿到会话后直接无感改密。
  if (!verifyPassword(oldPassword, auth.user.password_hash)) {
    return fail(CODE.OLD_PASSWORD_INCORRECT, MESSAGE.OLD_PASSWORD_INCORRECT);
  }

  await db
    .collection("users")
    .where({
      user_id: auth.user.user_id,
    })
    .update({
      data: {
        password_hash: hashPassword(newPassword),
        user_type: "account", // 确保用户类型为 account
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: auth.user.user_id,
    changed: true,
    has_password: true,
    user_type: "account",
  });
}

async function resetPasswordByWechat({ db, event, wxContext }) {
  const openid = String(wxContext.OPENID || "").trim();
  const password = String(
    pickEventField(event, ["password", "new_password", "newPassword"])
  );
  if (!openid || !assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  const binding = await getBindingByOpenId(db, openid);
  if (!binding) {
    return fail(CODE.USER_NOT_FOUND, MESSAGE.USER_NOT_FOUND);
  }

  // 仅允许已绑定账号（有 username）的用户通过微信身份重置密码。
  const user = await getUserByUserId(db, binding.user_id);
  if (!user || !user.username) {
    return fail(CODE.USER_NOT_FOUND, MESSAGE.USER_NOT_FOUND);
  }

  await db
    .collection("users")
    .where({
      user_id: user.user_id,
    })
    .update({
      data: {
        password_hash: hashPassword(password),
        user_type: "account", // 重置密码后，确保用户类型为 account
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: user.user_id,
    reset: true,
    user_type: "account",
  });
}

async function getAuthProfile({ db, auth }) {
  const binding = await getBindingByOpenId(db, auth.session.openid || "");
  return ok({
    user: sanitizeUser(auth.user),
    // 仅暴露布尔态，不回传 password_hash，避免前端接触敏感字段。
    has_password: Boolean(auth.user.password_hash),
    session: {
      session_token: auth.token,
      expire_at: auth.session.expire_at,
      login_type: auth.session.login_type,
    },
    binding: binding || null,
  });
}

async function logout({ db, auth }) {
  await db
    .collection("auth_sessions")
    .where({
      session_token: auth.token,
    })
    .update({
      data: {
        revoked: true,
        updated_at: new Date(),
      },
    });

  return ok({
    logout: true,
  });
}

async function updateNickname({ db, auth, event }) {
  const nickname = String(pickEventField(event, ["nickname"])).trim();
  
  // 验证昵称不能为空
  if (!nickname) {
    return fail(CODE.BAD_REQUEST, "昵称不能为空");
  }

  // 验证昵称长度（可选，根据业务需求调整）
  if (nickname.length > 50) {
    return fail(CODE.BAD_REQUEST, "昵称长度不能超过50个字符");
  }

  // 更新用户昵称（新增nickname字段，不影响username账户名）
  await db
    .collection("users")
    .where({
      user_id: auth.user.user_id,
    })
    .update({
      data: {
        nickname: nickname,
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: auth.user.user_id,
    nickname: nickname,
    user_type: "account",
    updated: true,
  });
}

async function updateUsername({ db, auth, event }) {
  const newUsername = String(pickEventField(event, ["username"])).trim().toLowerCase();
  
  // 验证账号名称不能为空
  if (!newUsername) {
    return fail(CODE.BAD_REQUEST, "账号名称不能为空");
  }

  // 验证账号名称格式：只能包含字母、数字、下划线，长度6-20位
  const usernameRegex = /^[a-zA-Z0-9_]{6,20}$/;
  if (!usernameRegex.test(newUsername)) {
    return fail(CODE.BAD_REQUEST, "账号名称只能包含字母、数字、下划线，长度6-20位");
  }

  // 检查账号名称是否已被其他用户使用
  const existingUser = await getUserByUsername(db, newUsername);
  if (existingUser && existingUser.user_id !== auth.user.user_id) {
    return fail(CODE.USERNAME_ALREADY_EXISTS, "账号名称已被使用");
  }

  // 更新用户账号名称
  await db
    .collection("users")
    .where({
      user_id: auth.user.user_id,
    })
    .update({
      data: {
        username: newUsername,
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: auth.user.user_id,
    username: newUsername,
    user_type: "account",
    updated: true,
  });
}

module.exports = {
  wxQuickLogin,
  passwordRegister,
  passwordLogin,
  setPassword,
  changePassword,
  resetPasswordByWechat,
  getAuthProfile,
  logout,
  updateNickname,
  updateUsername,
};
