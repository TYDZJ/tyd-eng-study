/**
 * 从 english-vocabulary-master 的 json-sentence 生成导入用 JSON。
 * 默认每本词书全量导入（IMPORT_WORD_LIMIT=0）。
 *
 * 用法：
 *   node scripts/import/prepare-dataset.js
 *   set ENGLISH_VOCAB_ROOT=D:\path\to\english-vocabulary-master
 *   set IMPORT_WORD_LIMIT=0   // 全量
 *   set IMPORT_WORD_LIMIT=50  // 抽样
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

function getBookShardFiles(sourceDir, prefix) {
  const files = fs
    .readdirSync(sourceDir)
    .map((name) => {
      const m = name.match(new RegExp(`^${prefix}_(\\d+)\\.json$`));
      if (!m) return null;
      return {
        name,
        index: Number(m[1]),
        filePath: path.join(sourceDir, name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  if (files.length === 0) {
    throw new Error(`未找到 ${prefix}_*.json 分片文件，目录: ${sourceDir}`);
  }
  return files;
}

function readMergedBookByShards(sourceDir, prefix) {
  const shards = getBookShardFiles(sourceDir, prefix);
  const merged = [];
  for (const shard of shards) {
    const arr = readJsonArray(shard.filePath);
    merged.push(...arr);
  }
  return { shards, merged };
}

function buildBookWords(bookId, rawList, limit) {
  const slice = limit > 0 ? rawList.slice(0, limit) : rawList;
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

  const sourceDir = path.dirname(CET4_SOURCE);
  const cet4Merged = readMergedBookByShards(sourceDir, "CET4");
  const cet6Merged = readMergedBookByShards(sourceDir, "CET6");
  const cet4Raw = cet4Merged.merged;
  const cet6Raw = cet6Merged.merged;

  const effectiveLimitLabel = LIMIT > 0 ? `前 ${LIMIT} 条` : "全量";
  const cet4Slice = LIMIT > 0 ? cet4Raw.slice(0, LIMIT) : cet4Raw;
  const cet6Slice = LIMIT > 0 ? cet6Raw.slice(0, LIMIT) : cet6Raw;

  const bookWordsCet4 = buildBookWords("cet4", cet4Raw, LIMIT);
  const bookWordsCet6 = buildBookWords("cet6", cet6Raw, LIMIT);

  const wordMap = new Map();
  for (const raw of cet4Slice) {
    const d = normalizeWordDoc(raw);
    if (d) wordMap.set(d._id, d);
  }
  for (const raw of cet6Slice) {
    const d = normalizeWordDoc(raw);
    if (d) wordMap.set(d._id, d);
  }

  const words = Array.from(wordMap.values()).sort((a, b) =>
    a._id.localeCompare(b._id),
  );

  const now = new Date().toISOString();
  const books = [
    {
      _id: "cet4",
      book_id: "cet4",
      name: "四级核心词汇",
      book_name: "四级核心词汇",
      book_desc: "大学英语四级考试核心词汇",
      level: 4,
      word_count: bookWordsCet4.length,
      total_count: bookWordsCet4.length,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      seq: 1,
      source: `json-sentence/${cet4Merged.shards[0].name}~${cet4Merged.shards[cet4Merged.shards.length - 1].name} (${effectiveLimitLabel})`,
      created_at: now,
      updated_at: now,
    },
    {
      _id: "cet6",
      book_id: "cet6",
      name: "六级核心词汇",
      book_name: "六级核心词汇",
      book_desc: "大学英语六级考试核心词汇",
      level: 6,
      word_count: bookWordsCet6.length,
      total_count: bookWordsCet6.length,
      cover_url: "",
      cover_color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      seq: 2,
      source: `json-sentence/${cet6Merged.shards[0].name}~${cet6Merged.shards[cet6Merged.shards.length - 1].name} (${effectiveLimitLabel})`,
      created_at: now,
      updated_at: now,
    },
    // {
    //   _id: "kaoyan",
    //   name: "考研核心词汇",
    //   description: "考研英语核心高频词汇",
    //   level: 7,
    //   word_count: 0,
    //   cover_url: "",
    //   cover_color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    //   seq: 3,
    //   source: "待导入",
    //   created_at: now,
    //   updated_at: now,
    // },
  ];

  fs.writeFileSync(OUT_BOOKS, JSON.stringify(books, null, 2), "utf8");
  fs.writeFileSync(OUT_WORDS, JSON.stringify(words, null, 2), "utf8");
  fs.writeFileSync(
    OUT_BOOK_WORDS_CET4,
    JSON.stringify(bookWordsCet4, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    OUT_BOOK_WORDS_CET6,
    JSON.stringify(bookWordsCet6, null, 2),
    "utf8",
  );

  console.log("prepare-dataset 完成");
  console.log("  词库根目录:", sourceDir);
  console.log(
    "  CET4 分片:",
    cet4Merged.shards.map((s) => s.name).join(", "),
  );
  console.log(
    "  CET6 分片:",
    cet6Merged.shards.map((s) => s.name).join(", "),
  );
  console.log("  每书条数上限:", LIMIT);
  console.log("  books:", books.length);
  console.log("  words(去重):", words.length);
  console.log("  book_words cet4:", bookWordsCet4.length);
  console.log("  book_words cet6:", bookWordsCet6.length);
  console.log("  输出目录:", DATA_DIR);
}

main();
