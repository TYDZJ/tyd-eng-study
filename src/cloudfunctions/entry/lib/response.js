"use strict";

const { CODE, MESSAGE } = require("./constants");

function ok(data = {}) {
  return {
    code: CODE.OK,
    message: MESSAGE.OK,
    data,
  };
}

function fail(code, message, data = null) {
  return {
    code,
    message,
    data,
  };
}

module.exports = {
  ok,
  fail,
};
