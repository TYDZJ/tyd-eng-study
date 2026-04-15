"use strict";

const crypto = require("crypto");

const HASH_ALGO = "scrypt";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

function hashPassword(password) {
  const value = String(password || "");
  const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = crypto.scryptSync(value, salt, KEY_LENGTH).toString("hex");
  return `${HASH_ALGO}$${salt}$${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  const value = String(password || "");
  const parts = String(passwordHash || "").split("$");
  if (parts.length !== 3 || parts[0] !== HASH_ALGO) {
    return false;
  }
  const salt = parts[1];
  const hash = parts[2];
  const derivedKey = crypto.scryptSync(value, salt, KEY_LENGTH).toString("hex");
  const sourceBuffer = Buffer.from(hash, "hex");
  const targetBuffer = Buffer.from(derivedKey, "hex");
  if (sourceBuffer.length !== targetBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sourceBuffer, targetBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
