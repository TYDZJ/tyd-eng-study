/**
 * 校验 prepare-dataset 生成的 JSON（不写云库）。
 */

const fs = require("fs");
const {
  OUT_BOOKS,
  OUT_WORDS,
  OUT_BOOK_WORDS_CET4,
  OUT_BOOK_WORDS_CET6,
} = require("./lib/config");

function loadJson(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`文件不存在，请先运行 prepare-dataset: ${path}`);
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const books = loadJson(OUT_BOOKS);
  const words = loadJson(OUT_WORDS);
  const bw4 = loadJson(OUT_BOOK_WORDS_CET4);
  const bw6 = loadJson(OUT_BOOK_WORDS_CET6);

  assert(Array.isArray(books) && books.length === 2, "books 应为 2 条（仅 cet4/cet6）");
  assert(
    books.some((b) => b._id === "cet4"),
    "缺少 cet4",
  );
  assert(
    books.some((b) => b._id === "cet6"),
    "缺少 cet6",
  );

  const wordSet = new Set(words.map((w) => w._id));
  assert(wordSet.size === words.length, "words 中存在重复 _id");

  const seq4 = bw4.map((r) => r.seq).sort((a, b) => a - b);
  const seq6 = bw6.map((r) => r.seq).sort((a, b) => a - b);
  assert(seq4[0] === 1 && seq4[seq4.length - 1] === bw4.length, "cet4 seq 非连续区间");
  assert(seq6[0] === 1 && seq6[seq6.length - 1] === bw6.length, "cet6 seq 非连续区间");

  for (const bw of [...bw4, ...bw6]) {
    assert(bw.book_id && bw.word_id && bw.seq, "book_words 字段不完整");
    assert(wordSet.has(bw.word_id), `word_id 在 words 中不存在: ${bw.word_id}`);
  }

  const book4 = books.find((b) => b._id === "cet4");
  const book6 = books.find((b) => b._id === "cet6");
  assert(
    book4.word_count === bw4.length,
    "cet4 word_count 与 book_words 不一致",
  );
  assert(
    book6.word_count === bw6.length,
    "cet6 word_count 与 book_words 不一致",
  );

  let emptyTrans = 0;
  for (const w of words) {
    if (!w.translations || w.translations.length === 0) emptyTrans += 1;
  }
  if (emptyTrans > 0) {
    console.warn(`警告: 有 ${emptyTrans} 个词条 translations 为空`);
  }

  console.log("verify-import 通过");
  console.log("  words:", words.length);
  console.log("  book_words cet4/cet6:", bw4.length, bw6.length);
}

main();
