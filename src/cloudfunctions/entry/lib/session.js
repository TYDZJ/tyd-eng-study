"use strict";

const crypto = require("crypto");

const SESSION_EXPIRE_DAYS = 30;

function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function makeUserId() {
  return `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function getSessionExpireAt() {
  const now = new Date();
  now.setDate(now.getDate() + SESSION_EXPIRE_DAYS);
  return now;
}

async function createSession(db, payload) {
  const sessionToken = makeSessionToken();
  const now = new Date();
  const expireAt = getSessionExpireAt();
  await db.collection("auth_sessions").add({
    data: {
      session_token: sessionToken,
      user_id: payload.userId,
      openid: payload.openid || "",
      login_type: payload.loginType || "unknown",
      revoked: false,
      created_at: now,
      updated_at: now,
      expire_at: expireAt,
    },
  });
  return {
    session_token: sessionToken,
    expire_at: expireAt,
  };
}

module.exports = {
  createSession,
  makeUserId,
};
