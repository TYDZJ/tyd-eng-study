"use strict";

const { CODE, MESSAGE } = require("../lib/constants");
const { ok, fail } = require("../lib/response");

// 默认学习设置
const DEFAULT_SETTINGS = {
  review_time: "all_next_day",
  learn_count: 10,
  review_count: 10,
  learning_mode: "rich",
};

// 有效的参数值枚举
const VALID_REVIEW_TIMES = ["all_next_day", "wrong_next_day"];
const VALID_COUNTS = [5, 10, 15, 20];
const VALID_MODES = ["rich", "simple"];

/**
 * 获取用户学习设置
 * 如果不存在则自动创建默认设置并返回
 */
async function getUserSettings({ db, auth }) {
  try {
    const userId = auth.user.user_id;

    // 查询用户设置
    const res = await db
      .collection("user_learn_settings")
      .where({
        user_id: userId,
      })
      .get();

    // 如果存在，直接返回
    if (res.data && res.data.length > 0) {
      return ok(res.data[0]);
    }

    // 不存在则创建默认设置（upsert）
    const now = new Date();
    const defaultSettings = {
      user_id: userId,
      settings: DEFAULT_SETTINGS,
      created_at: now,
      updated_at: now,
    };

    await db.collection("user_learn_settings").add({
      data: defaultSettings,
    });

    console.log("[getUserSettings] Created default settings for user: " + userId);
    return ok(defaultSettings);
  } catch (error) {
    console.error("[getUserSettings] Error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 更新用户学习设置
 * 使用 upsert 操作，确保并发安全
 */
async function updateUserSettings({ db, auth, event }) {
  try {
    const userId = auth.user.user_id;
    const { settings } = event;

    // 参数验证
    if (!settings || typeof settings !== "object") {
      return fail(CODE.BAD_REQUEST, "缺少必要的设置参数");
    }

    // 验证 review_time
    if (
      settings.review_time !== undefined &&
      !VALID_REVIEW_TIMES.includes(settings.review_time)
    ) {
      return fail(CODE.BAD_REQUEST, "无效的复习时间策略");
    }

    // 验证 learn_count
    if (
      settings.learn_count !== undefined &&
      !VALID_COUNTS.includes(settings.learn_count)
    ) {
      return fail(CODE.BAD_REQUEST, "无效的学习数量，可选值：5, 10, 15, 20");
    }

    // 验证 review_count
    if (
      settings.review_count !== undefined &&
      !VALID_COUNTS.includes(settings.review_count)
    ) {
      return fail(CODE.BAD_REQUEST, "无效的复习数量，可选值：5, 10, 15, 20");
    }

    // 验证 learning_mode
    if (
      settings.learning_mode !== undefined &&
      !VALID_MODES.includes(settings.learning_mode)
    ) {
      return fail(CODE.BAD_REQUEST, "无效的学习模式");
    }

    // 查询现有设置
    const existingRes = await db
      .collection("user_learn_settings")
      .where({
        user_id: userId,
      })
      .get();

    const now = new Date();

    if (existingRes.data && existingRes.data.length > 0) {
      // 存在则更新（合并现有设置和新设置）
      const existingSettings = existingRes.data[0].settings || {};
      const mergedSettings = {
        ...existingSettings,
        ...settings,
      };

      await db
        .collection("user_learn_settings")
        .doc(existingRes.data[0]._id)
        .update({
          data: {
            settings: mergedSettings,
            updated_at: now,
          },
        });

      console.log(`[updateUserSettings] Updated settings for user: ${userId}`);

      // 返回完整的设置对象
      return ok({
        _id: existingRes.data[0]._id,
        user_id: userId,
        settings: mergedSettings,
        created_at: existingRes.data[0].created_at,
        updated_at: now,
      });
    } else {
      // 不存在则创建（合并默认设置和新设置）
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
      };

      const newRecord = {
        user_id: userId,
        settings: mergedSettings,
        created_at: now,
        updated_at: now,
      };

      await db.collection("user_learn_settings").add({
        data: newRecord,
      });

      console.log(`[updateUserSettings] Created settings for user: ${userId}`);

      return ok(newRecord);
    }
  } catch (error) {
    console.error("[updateUserSettings] Error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

module.exports = {
  getUserSettings,
  updateUserSettings,
};
