"use strict";

const { ok } = require("../lib/response");

async function getLearnWords({ db, _, event }) {
  const bookId = String(event.book_id || "cet4");
  const count = Math.min(40, Math.max(1, Number(event.count) || 20));
  const currentSeq = 0;

  const bookWordsRes = await db
    .collection("book_words")
    .where({
      book_id: bookId,
      seq: _.gt(0),
    })
    .orderBy("seq", "asc")
    .limit(count)
    .get();

  const bookWords = bookWordsRes.data || [];
  const wordIds = bookWords.map((row) => row.word_id);
  if (wordIds.length === 0) {
    return ok({
      book_id: bookId,
      current_seq: currentSeq,
      words: [],
    });
  }

  const wordsRes = await db
    .collection("words")
    .where({
      _id: _.in(wordIds),
    })
    .get();

  const wordsMap = new Map((wordsRes.data || []).map((w) => [w._id, w]));
  const words = bookWords
    .map((row) => wordsMap.get(row.word_id))
    .filter(Boolean);

  return ok({
    book_id: bookId,
    current_seq: currentSeq,
    words,
  });
}

module.exports = {
  getLearnWords,
};
