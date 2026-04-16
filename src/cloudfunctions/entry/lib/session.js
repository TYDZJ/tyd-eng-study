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

  // 如果提供了 openid，先删除该 openid 的所有旧会话，避免唯一索引冲突
  if (payload.openid && payload.openid.trim()) {
    try {
      const removeResult = await db
        .collection("auth_sessions")
        .where({
          openid: payload.openid,
        })
        .remove();
      
      console.log(`[createSession] Removed ${removeResult.stats?.removed || 0} old sessions for openid: ${payload.openid}`);
    } catch (removeError) {
      console.error(`[createSession] Failed to remove old sessions:`, removeError);
      // 即使删除失败，也继续尝试创建新会话
    }
  }

  try {
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
    
    console.log(`[createSession] Created new session for user: ${payload.userId}`);
  } catch (addError) {
    console.error(`[createSession] Failed to create session:`, addError);
    throw addError;
  }

  return {
    session_token: sessionToken,
    expire_at: expireAt,
  };
}

module.exports = {
  createSession,
  makeUserId,
};
