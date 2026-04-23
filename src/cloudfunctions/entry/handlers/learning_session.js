"use strict";

const { CODE, MESSAGE } = require("../lib/constants");
const { ok, fail } = require("../lib/response");

/**
 * 生成 UUID v4（简易实现）
 */
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * SM2 算法更新单词记忆状态
 * @param {Object} wordState - 当前单词状态
 * @param {String} rating - 评分：again/hard/good/easy
 * @returns {Object} 更新后的状态
 */
function updateSM2State(wordState, rating) {
  // 质量分映射
  const qualityMap = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = qualityMap[rating] || 4;

  let { reps = 0, ease_factor = 2.5, interval_days = 0, lapses = 0 } = wordState;

  if (q < 3) {
    // 遗忘：重置
    reps = 0;
    interval_days = 0;
    lapses++;
  } else {
    // 记住：增长
    if (reps === 0) {
      interval_days = 1;
    } else if (reps === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    reps++;
  }

  // 更新难度系数
  ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease_factor = Math.max(1.3, Math.min(2.5, ease_factor)); // 限制范围 [1.3, 2.5]

  // 计算下次复习时间
  const next_review_at = new Date(Date.now() + interval_days * 24 * 60 * 60 * 1000);

  // 确定状态
  let status = "learning";
  if (wordState.status === "new") {
    status = "learning";
  } else if (reps >= 3 && interval_days > 7) {
    status = "review";
  }
  if (interval_days > 30) {
    status = "mastered";
  }

  return {
    status,
    reps,
    ease_factor,
    interval_days,
    lapses,
    last_review_at: new Date(),
    next_review_at,
  };
}

/**
 * 获取或创建活动会话
 */
async function getOrCreateActiveSession({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const bookId = String(event.book_id || "cet4").trim();
    const mode = String(event.mode || "learn").trim();
    const sessionSize = Math.min(20, Math.max(1, Number(event.session_size) || 20));

    // 验证 mode
    if (!["learn", "review"].includes(mode)) {
      return fail(CODE.BAD_REQUEST, "mode 必须为 learn 或 review");
    }

    // 1. 查询是否存在 running 状态的会话
    const runningSessionRes = await db
      .collection("study_sessions")
      .where({
        openid,
        book_id: bookId,
        mode,
        status: "running",
      })
      .limit(1)
      .get();

    const runningSession = (runningSessionRes.data || [])[0];

    if (runningSession) {
      // 2. 存在 running 会话，返回该会话及完整数据
      return await getSessionWithWords(db, _, runningSession._id);
    }

    // 3. 不存在 running 会话，创建新会话
    // 3.1 根据模式获取待学习/复习的单词列表
    const wordIds = await getWordIdsForMode(db, _, openid, bookId, mode, sessionSize);

    if (wordIds.length === 0) {
      return ok({
        session_id: null,
        book_id: bookId,
        mode,
        status: "finished",
        target_count: 0,
        finished_count: 0,
        words: [],
        progress_map: {},
        message: "暂无可学习的单词",
      });
    }

    // 3.2 创建会话记录
    const sessionId = `sess_${Date.now()}_${generateUUID().substring(0, 8)}`;
    const now = new Date();

    await db.collection("study_sessions").add({
      data: {
        _id: sessionId,
        openid,
        book_id: bookId,
        mode,
        word_ids: wordIds,
        target_count: wordIds.length,
        finished_count: 0,
        status: "running",
        current_stage: mode === "learn" ? "card" : "learn",
        created_at: now,
        updated_at: now,
      },
    });

    // 3.3 为每个单词创建进度记录
    const progressPromises = wordIds.map((wordId) =>
      db.collection("study_session_word_progress").add({
        data: {
          session_id: sessionId,
          openid,
          book_id: bookId,
          word_id: wordId,
          card_done: mode === "review", // 复习模式跳过 card 阶段
          learn_done: false,
          latest_rating: null,
          updated_at: now,
        },
      })
    );

    await Promise.all(progressPromises);

    // 3.4 返回新创建的会话
    return await getSessionWithWords(db, _, sessionId);
  } catch (error) {
    console.error("[getOrCreateActiveSession] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 获取会话详情并组装完整数据
 */
async function getSessionWithWords(db, _, sessionId) {
  // 1. 获取会话信息
  const sessionRes = await db
    .collection("study_sessions")
    .where({ _id: sessionId })
    .limit(1)
    .get();

  const session = (sessionRes.data || [])[0];
  if (!session) {
    return fail(CODE.SESSION_NOT_FOUND, MESSAGE.SESSION_NOT_FOUND);
  }

  // 2. 获取所有单词进度
  const progressRes = await db
    .collection("study_session_word_progress")
    .where({ session_id: sessionId })
    .get();

  const progressList = progressRes.data || [];
  const progressMap = {};
  progressList.forEach((p) => {
    progressMap[p.word_id] = {
      card_done: p.card_done,
      learn_done: p.learn_done,
      latest_rating: p.latest_rating,
    };
  });

  // 3. 获取完整单词数据
  const wordIds = session.word_ids || [];
  let words = [];
  if (wordIds.length > 0) {
    const wordsRes = await db
      .collection("words")
      .where({
        _id: _.in(wordIds),
      })
      .get();

    words = wordsRes.data || [];
  }

  // 4. 为每个单词生成四选一选项（仅学习模式需要）
  if (session.mode === "learn" && words.length > 0) {
    words = await generateOptionsForWords(db, _, words);
  }

  return ok({
    session_id: session._id,
    book_id: session.book_id,
    mode: session.mode,
    status: session.status,
    target_count: session.target_count,
    finished_count: session.finished_count,
    current_stage: session.current_stage,
    words,
    progress_map: progressMap,
  });
}

/**
 * 为单词列表生成四选一选项
 */
async function generateOptionsForWords(db, _, words) {
  // 收集所有单词的中文释义，用于生成干扰项
  const allWordTranslations = [];
  words.forEach((word) => {
    if (word.translations && word.translations.length > 0) {
      const tran = word.translations[0];
      allWordTranslations.push({
        word_id: word._id,
        word: word.word,
        type: tran.type || "",       // 词性（如 v., n., adj.）
        translation: tran.translation || "", // 中文释义
      });
    }
  });

  console.log('[generateOptionsForWords] 收集的翻译数据:', {
    totalWords: words.length,
    totalTranslations: allWordTranslations.length,
    sampleData: allWordTranslations.slice(0, 3)
  });

  // 为每个单词生成 options
  const wordsWithOptions = words.map((word) => {
    if (!word.translations || word.translations.length === 0) {
      console.warn(`[generateOptionsForWords] 单词 ${word._id} 没有翻译数据`);
      return { ...word, options: [] };
    }

    const correctTran = word.translations[0];
    const correctOption = {
      en: word.word,
      cn: `${correctTran.type ? correctTran.type + ' ' : ''}${correctTran.translation || ''}`.trim(),
    };

    console.log(`[generateOptionsForWords] 单词 ${word._id} 正确选项:`, correctOption);

    // 从其他单词中随机选择 3 个干扰项
    const distractors = [];
    const otherTranslations = allWordTranslations.filter(
      (t) => t.word_id !== word._id
    );

    // 随机打乱
    const shuffled = [...otherTranslations].sort(() => Math.random() - 0.5);

    // 取前 3 个
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      distractors.push({
        en: shuffled[i].word,
        cn: `${shuffled[i].type ? shuffled[i].type + ' ' : ''}${shuffled[i].translation || ''}`.trim(),
      });
    }

    console.log(`[generateOptionsForWords] 单词 ${word._id} 干扰项:`, distractors);

    // 合并正确项和干扰项，然后打乱顺序
    const allOptions = [correctOption, ...distractors];
    const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

    console.log(`[generateOptionsForWords] 单词 ${word._id} 最终选项数量:`, shuffledOptions.length);

    return {
      ...word,
      options: shuffledOptions,
    };
  });

  return wordsWithOptions;
}

/**
 * 根据模式获取待学习/复习的单词 ID 列表
 */
async function getWordIdsForMode(db, _, openid, bookId, mode, limit) {
  if (mode === "learn") {
    // 学习模式：获取 status="new" 的单词
    const userWordStates = await db
      .collection("user_word_state")
      .where({
        openid,
        book_id: bookId,
        status: "new",
      })
      .limit(limit)
      .get();

    let wordIds = (userWordStates.data || []).map((s) => s.word_id);

    // 如果没有 new 状态的单词，从词书中获取未学习的单词
    if (wordIds.length === 0) {
      // 获取用户已学习过的单词 ID
      const learnedStates = await db
        .collection("user_word_state")
        .where({
          openid,
          book_id: bookId,
        })
        .field({ word_id: true })
        .get();

      const learnedWordIds = (learnedStates.data || []).map((s) => s.word_id);

      // 从词书中排除已学习的单词
      const bookWordsRes = await db
        .collection("book_words")
        .where({
          book_id: bookId,
          ...(learnedWordIds.length > 0 ? { word_id: _.nin(learnedWordIds) } : {}),
        })
        .orderBy("seq", "asc")
        .limit(limit)
        .field({ word_id: true })
        .get();

      wordIds = (bookWordsRes.data || []).map((w) => w.word_id);

      // 为新单词创建 user_word_state 记录
      if (wordIds.length > 0) {
        const now = new Date();
        const statePromises = wordIds.map((wordId) =>
          db.collection("user_word_state").add({
            data: {
              openid,
              book_id: bookId,
              word_id: wordId,
              status: "new",
              reps: 0,
              ease_factor: 2.5,
              interval_days: 0,
              lapses: 0,
              next_review_at: now,
              created_at: now,
              updated_at: now,
            },
          })
        );
        await Promise.all(statePromises);
      }
    }

    return wordIds.slice(0, limit);
  } else {
    // 复习模式：获取 next_review_at <= 现在的单词
    const now = new Date();
    const reviewStates = await db
      .collection("user_word_state")
      .where({
        openid,
        book_id: bookId,
        next_review_at: _.lte(now),
        status: _.neq("new"), // 排除新词
      })
      .orderBy("next_review_at", "asc")
      .limit(limit)
      .get();

    return (reviewStates.data || []).map((s) => s.word_id);
  }
}

/**
 * 提交单词进度
 */
async function submitWordProgress({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const sessionId = String(event.session_id || "").trim();
    const bookId = String(event.book_id || "").trim();
    const wordId = String(event.word_id || "").trim();
    const stage = String(event.stage || "").trim();
    const rating = event.rating ? String(event.rating).trim() : null;
    const requestId = String(event.request_id || "").trim();
    const costMs = Number(event.cost_ms) || 0;

    // 参数验证
    if (!sessionId || !wordId || !stage) {
      return fail(CODE.BAD_REQUEST, "缺少必要参数");
    }

    if (!["card", "learn"].includes(stage)) {
      return fail(CODE.STAGE_INVALID, MESSAGE.STAGE_INVALID);
    }

    if (rating && !["again", "hard", "good", "easy"].includes(rating)) {
      return fail(CODE.BAD_REQUEST, "rating 必须为 again/hard/good/easy");
    }

    // 1. 幂等性检查：查询是否已存在相同 request_id 的日志
    if (requestId) {
      const existingLog = await db
        .collection("study_logs")
        .where({ request_id: requestId })
        .limit(1)
        .get();

      if ((existingLog.data || []).length > 0) {
        // 已存在，直接返回上次结果
        const log = existingLog.data[0];
        return ok({
          session_id: log.session_id,
          word_id: log.word_id,
          is_duplicate: true,
          message: "请求已处理",
        });
      }
    }

    // 2. 验证会话存在且属于当前用户
    const sessionRes = await db
      .collection("study_sessions")
      .where({
        _id: sessionId,
        openid,
      })
      .limit(1)
      .get();

    const session = (sessionRes.data || [])[0];
    if (!session) {
      return fail(CODE.SESSION_NOT_FOUND, MESSAGE.SESSION_NOT_FOUND);
    }

    if (session.status !== "running") {
      return fail(CODE.SESSION_CONFLICT, MESSAGE.SESSION_CONFLICT);
    }

    // 3. 验证单词在会话中
    if (!session.word_ids.includes(wordId)) {
      return fail(CODE.WORD_NOT_IN_SESSION, MESSAGE.WORD_NOT_IN_SESSION);
    }

    // 4. 验证阶段合法性（复习模式不允许 card 阶段）
    if (session.mode === "review" && stage === "card") {
      return fail(CODE.STAGE_INVALID, "复习模式不支持 card 阶段");
    }

    const now = new Date();

    // 5. 更新单词进度
    const updateData = {
      updated_at: now,
    };

    if (stage === "card") {
      updateData.card_done = true;
    } else if (stage === "learn") {
      updateData.learn_done = true;
      if (rating) {
        updateData.latest_rating = rating;
      }
    }

    await db
      .collection("study_session_word_progress")
      .where({
        session_id: sessionId,
        word_id: wordId,
      })
      .update({
        data: updateData,
      });

    // 6. 写入日志（幂等键）
    if (requestId) {
      await db.collection("study_logs").add({
        data: {
          request_id: requestId,
          session_id: sessionId,
          word_id: wordId,
          stage,
          rating: rating || null,
          cost_ms: costMs,
          is_correct: rating === "good" || rating === "easy",
          created_at: now,
        },
      });
    }

    // 7. 触发 SM2 算法更新（仅 learn 阶段且有 rating）
    let nextReviewAt = null;
    if (stage === "learn" && rating) {
      // 查询或创建 user_word_state
      const stateRes = await db
        .collection("user_word_state")
        .where({
          openid,
          book_id: bookId || session.book_id,
          word_id: wordId,
        })
        .limit(1)
        .get();

      let wordState = (stateRes.data || [])[0];
      if (!wordState) {
        // 创建新记录
        wordState = {
          openid,
          book_id: bookId || session.book_id,
          word_id: wordId,
          status: "new",
          reps: 0,
          ease_factor: 2.5,
          interval_days: 0,
          lapses: 0,
          next_review_at: now,
        };
      }

      // 更新 SM2 状态
      const updatedState = updateSM2State(wordState, rating);
      nextReviewAt = updatedState.next_review_at;

      await db
        .collection("user_word_state")
        .where({
          openid,
          book_id: bookId || session.book_id,
          word_id: wordId,
        })
        .update({
          data: {
            ...updatedState,
            updated_at: now,
          },
        });
    }

    // 8. 更新会话进度
    // 8.1 查询当前已完成数量
    const progressRes = await db
      .collection("study_session_word_progress")
      .where({ session_id: sessionId })
      .get();

    const progressList = progressRes.data || [];
    const finishedCount = progressList.filter((p) => {
      // 判断单词是否完成所有阶段
      if (session.mode === "learn") {
        return p.card_done && p.learn_done;
      } else {
        return p.learn_done;
      }
    }).length;

    // 8.2 更新会话
    const isFinished = finishedCount >= session.target_count;
    await db
      .collection("study_sessions")
      .where({ _id: sessionId })
      .update({
        data: {
          finished_count: finishedCount,
          status: isFinished ? "finished" : "running",
          updated_at: now,
        },
      });

    // 9. 返回结果
    const wordProgress = progressList.find((p) => p.word_id === wordId);

    return ok({
      session_id: sessionId,
      word_id: wordId,
      word_progress: {
        card_done: wordProgress?.card_done || false,
        learn_done: wordProgress?.learn_done || false,
        latest_rating: wordProgress?.latest_rating || null,
      },
      session_progress: {
        finished_count: finishedCount,
        target_count: session.target_count,
        session_finished: isFinished,
      },
      next_review_at: nextReviewAt,
    });
  } catch (error) {
    console.error("[submitWordProgress] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 结束会话
 */
async function finishSession({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const sessionId = String(event.session_id || "").trim();

    if (!sessionId) {
      return fail(CODE.BAD_REQUEST, "缺少 session_id");
    }

    // 1. 验证会话
    const sessionRes = await db
      .collection("study_sessions")
      .where({
        _id: sessionId,
        openid,
      })
      .limit(1)
      .get();

    const session = (sessionRes.data || [])[0];
    if (!session) {
      return fail(CODE.SESSION_NOT_FOUND, MESSAGE.SESSION_NOT_FOUND);
    }

    if (session.status === "finished") {
      // 已完成，直接返回
      return ok({
        session_id: sessionId,
        status: "finished",
        finished_count: session.finished_count,
        target_count: session.target_count,
      });
    }

    if (session.status !== "running") {
      return fail(CODE.SESSION_CONFLICT, MESSAGE.SESSION_CONFLICT);
    }

    const now = new Date();

    // 2. 更新会话状态
    await db
      .collection("study_sessions")
      .where({ _id: sessionId })
      .update({
        data: {
          status: "finished",
          updated_at: now,
        },
      });

    // 3. 统计今日学习数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const progressRes = await db
      .collection("study_session_word_progress")
      .where({ session_id: sessionId })
      .get();

    const progressList = progressRes.data || [];
    const learnedCount = progressList.filter((p) => p.learn_done).length;
    const reviewedCount = session.mode === "review" ? learnedCount : 0;

    // 4. 更新或创建 user_learning_stats（upsert）
    const statsRes = await db
      .collection("user_learning_stats")
      .where({
        openid,
        date: today.toISOString().split("T")[0],
      })
      .limit(1)
      .get();

    const existingStats = (statsRes.data || [])[0];

    if (existingStats) {
      // 更新
      await db
        .collection("user_learning_stats")
        .where({ _id: existingStats._id })
        .update({
          data: {
            learned_count: _.inc(learnedCount),
            reviewed_count: _.inc(reviewedCount),
            updated_at: now,
          },
        });
    } else {
      // 创建
      await db.collection("user_learning_stats").add({
        data: {
          openid,
          date: today.toISOString().split("T")[0],
          learned_count: learnedCount,
          reviewed_count: reviewedCount,
          created_at: now,
          updated_at: now,
        },
      });
    }

    return ok({
      session_id: sessionId,
      status: "finished",
      finished_count: session.finished_count,
      target_count: session.target_count,
    });
  } catch (error) {
    console.error("[finishSession] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 获取会话详情（调试用）
 */
async function getSessionState({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const sessionId = String(event.session_id || "").trim();

    if (!sessionId) {
      return fail(CODE.BAD_REQUEST, "缺少 session_id");
    }

    return await getSessionWithWords(db, _, sessionId);
  } catch (error) {
    console.error("[getSessionState] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 放弃会话
 */
async function abandonSession({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const sessionId = String(event.session_id || "").trim();

    if (!sessionId) {
      return fail(CODE.BAD_REQUEST, "缺少 session_id");
    }

    const now = new Date();

    // 更新会话状态为 aborted
    const result = await db
      .collection("study_sessions")
      .where({
        _id: sessionId,
        openid,
        status: "running",
      })
      .update({
        data: {
          status: "aborted",
          updated_at: now,
        },
      });

    if (result.updated === 0) {
      return fail(CODE.SESSION_NOT_FOUND, "会话不存在或已结束");
    }

    return ok({
      session_id: sessionId,
      status: "aborted",
    });
  } catch (error) {
    console.error("[abandonSession] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

/**
 * 获取今日学习计划
 */
async function getTodayPlan({ db, _, event, auth }) {
  try {
    const openid = auth.openid;
    const bookId = String(event.book_id || "cet4").trim();

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 1. 获取用户设置
    const settingsRes = await db
      .collection("user_learn_settings")
      .where({ user_id: openid })
      .limit(1)
      .get();

    const settings = (settingsRes.data || [])[0];
    const learnCount = settings?.settings?.learn_count || 20;
    const reviewCount = settings?.settings?.review_count || 20;

    // 2. 统计新词数量
    const newWordsRes = await db
      .collection("user_word_state")
      .where({
        openid,
        book_id: bookId,
        status: "new",
      })
      .count();

    const totalNewWords = newWordsRes.total || 0;

    // 3. 统计今日已学习新词数量
    const statsRes = await db
      .collection("user_learning_stats")
      .where({
        openid,
        date: today,
      })
      .limit(1)
      .get();

    const todayStats = (statsRes.data || [])[0];
    const todayLearned = todayStats?.learned_count || 0;

    // 4. 计算剩余配额
    const remainingNew = Math.max(0, learnCount - todayLearned);

    // 5. 统计待复习数量
    const reviewDueRes = await db
      .collection("user_word_state")
      .where({
        openid,
        book_id: bookId,
        next_review_at: _.lte(now),
        status: _.neq("new"),
      })
      .count();

    const reviewDueCount = reviewDueRes.total || 0;

    // 6. 统计超期未复习数量（昨天之前应复习的）
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const overdueRes = await db
      .collection("user_word_state")
      .where({
        openid,
        book_id: bookId,
        next_review_at: _.lte(yesterday),
        status: _.neq("new"),
      })
      .count();

    const overdueCount = overdueRes.total || 0;

    return ok({
      book_id: bookId,
      today_new_quota: learnCount,
      today_new_remaining: Math.min(remainingNew, totalNewWords),
      total_new_words: totalNewWords,
      review_due_count: reviewDueCount,
      review_overdue_count: overdueCount,
    });
  } catch (error) {
    console.error("[getTodayPlan] error:", error);
    return fail(CODE.INTERNAL_ERROR, MESSAGE.INTERNAL_ERROR);
  }
}

module.exports = {
  getOrCreateActiveSession,
  submitWordProgress,
  finishSession,
  getSessionState,
  abandonSession,
  getTodayPlan,
};
