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
    username: payload.username || "",
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
  const username = normalizeUsername(event.username);
  const password = String(event.password || "");

  if (!openid || !username || !assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  const bound = await getBindingByOpenId(db, openid);
  if (bound) {
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
  const username = normalizeUsername(event.username);
  const password = String(event.password || "");
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
    openid: "",
    loginType: "password",
  });

  return ok({
    user: sanitizeUser(user),
    session,
  });
}

async function setPassword({ db, auth, event }) {
  const password = String(event.password || "");
  if (!assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  await db
    .collection("users")
    .where({
      user_id: auth.user.user_id,
    })
    .update({
      data: {
        password_hash: hashPassword(password),
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: auth.user.user_id,
    changed: true,
  });
}

async function resetPasswordByWechat({ db, event, wxContext }) {
  const openid = String(wxContext.OPENID || "").trim();
  const password = String(event.password || "");
  if (!openid || !assertPassword(password)) {
    return fail(CODE.BAD_REQUEST, MESSAGE.BAD_REQUEST);
  }

  const binding = await getBindingByOpenId(db, openid);
  if (!binding) {
    return fail(CODE.USER_NOT_FOUND, MESSAGE.USER_NOT_FOUND);
  }

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
        updated_at: new Date(),
      },
    });

  return ok({
    user_id: user.user_id,
    reset: true,
  });
}

async function getAuthProfile({ db, auth }) {
  const binding = await getBindingByOpenId(db, auth.session.openid || "");
  return ok({
    user: sanitizeUser(auth.user),
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

module.exports = {
  wxQuickLogin,
  passwordRegister,
  passwordLogin,
  setPassword,
  resetPasswordByWechat,
  getAuthProfile,
  logout,
};
