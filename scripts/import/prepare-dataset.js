/**
 * 从 english-vocabulary-master 的 json-sentence 生成导入用 JSON。
 * 默认每本词书各取前 IMPORT_WORD_LIMIT 条（默认 50）。
 *
 * 用法：
 *   node scripts/import/prepare-dataset.js
 *   set ENGLISH_VOCAB_ROOT=D:\path\to\english-vocabulary-master
 *   set IMPORT_WORD_LIMIT=50
 */

const fs = require("fs");
const path = require("path");
const {
  LIMIT,
  CET4_SOURCE,
  CET6_SOURCE,
  DATA_DIR,
  OUT_BOOKS,
  OUT_WORDS,
  OUT_BOOK_WORDS_CET4,
  OUT_BOOK_WORDS_CET6,
} = require("./lib/config");
const { normalizeWordDoc } = require("./lib/normalize-entry");

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`词库文件不存在: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(`期望 JSON 数组: ${filePath}`);
  }
  return data;
}

function buildBookWords(bookId, rawList, limit) {
  const slice = rawList.slice(0, limit);
  const rows = [];
  let seq = 1;
  for (const raw of slice) {
    const doc = normalizeWordDoc(raw);
    if (!doc) continue;
    rows.push({
      _id: `${bookId}_${seq}`,
      book_id: bookId,
      word_id: doc._id,
      seq,
      tags: [],
    });
    seq += 1;
  }
  return rows;
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const cet4Raw = readJsonArray(CET4_SOURCE);
  const cet6Raw = readJsonArray(CET6_SOURCE);

  const bookWordsCet4 = buildBookWords("cet4", cet4Raw, LIMIT);
  const bookWordsCet6 = buildBookWords("cet6", cet6Raw, LIMIT);

  const wordMap = new Map();
  for (const raw of cet4Raw.slice(0, LIMIT)) {
    const d = normalizeWordDoc(raw);
    if (d) wordMap.set(d._id, d);
  }
  for (const raw of cet6Raw.slice(0, LIMIT)) {
    const d = normalizeWordDoc(raw);
    if (d) wordMap.set(d._id, d);
  }

  const words = Array.from(wordMap.values()).sort((a, b) =>
    a._id.localeCompare(b._id)
  );

  const now = new Date().toISOString();
  const books = [
    {
      _id: "cet4",
      name: "四级核心词汇",
      description: "大学英语四级考试核心词汇",
      level: 4,
      word_count: bookWordsCet4.length,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      seq: 1,
      source: `json-sentence/CET4_1.json (前 ${LIMIT} 条)`,
      created_at: now,
      updated_at: now,
    },
    {
      _id: "cet6",
      name: "六级核心词汇",
      description: "大学英语六级考试核心词汇",
      level: 6,
      word_count: bookWordsCet6.length,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      seq: 2,
      source: `json-sentence/CET6_1.json (前 ${LIMIT} 条)`,
      created_at: now,
      updated_at: now,
    },
    {
      _id: "kaoyan",
      name: "考研核心词汇",
      description: "考研英语核心高频词汇",
      level: 7,
      word_count: 0,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      seq: 3,
      source: "待导入",
      created_at: now,
      updated_at: now,
    },
    {
      _id: "ielts",
      name: "雅思核心词汇",
      description: "雅思考试必备核心词汇",
      level: 8,
      word_count: 0,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      seq: 4,
      source: "待导入",
      created_at: now,
      updated_at: now,
    },
  ];

  fs.writeFileSync(OUT_BOOKS, JSON.stringify(books, null, 2), "utf8");
  fs.writeFileSync(OUT_WORDS, JSON.stringify(words, null, 2), "utf8");
  fs.writeFileSync(
    OUT_BOOK_WORDS_CET4,
    JSON.stringify(bookWordsCet4, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    OUT_BOOK_WORDS_CET6,
    JSON.stringify(bookWordsCet6, null, 2),
    "utf8"
  );

  console.log("prepare-dataset 完成");
  console.log("  词库根目录:", path.dirname(CET4_SOURCE));
  console.log("  每书条数上限:", LIMIT);
  console.log("  books:", books.length);
  console.log("  words(去重):", words.length);
  console.log("  book_words cet4:", bookWordsCet4.length);
  console.log("  book_words cet6:", bookWordsCet6.length);
  console.log("  输出目录:", DATA_DIR);
}

main();
