"use strict";

const { CODE, MESSAGE } = require("./constants");

async function getSession(db, _, sessionToken) {
  const now = new Date();
  const res = await db
    .collection("auth_sessions")
    .where({
      session_token: sessionToken,
      revoked: false,
      expire_at: _.gt(now),
    })
    .limit(1)
    .get();
  return (res.data || [])[0] || null;
}

async function getUserByUserId(db, userId) {
  const res = await db
    .collection("users")
    .where({
      user_id: userId,
    })
    .limit(1)
    .get();
  return (res.data || [])[0] || null;
}

async function requireAuth({ db, _, event }) {
  const token = String(event.session_token || "").trim();
  if (!token) {
    return {
      ok: false,
      error: {
        code: CODE.UNAUTHORIZED,
        message: MESSAGE.UNAUTHORIZED,
      },
    };
  }

  const session = await getSession(db, _, token);
  if (!session) {
    return {
      ok: false,
      error: {
        code: CODE.UNAUTHORIZED,
        message: MESSAGE.UNAUTHORIZED,
      },
    };
  }

  const user = await getUserByUserId(db, session.user_id);
  if (!user) {
    return {
      ok: false,
      error: {
        code: CODE.USER_NOT_FOUND,
        message: MESSAGE.USER_NOT_FOUND,
      },
    };
  }

  return {
    ok: true,
    session,
    user,
    token,
  };
}

module.exports = {
  requireAuth,
  getUserByUserId,
};
