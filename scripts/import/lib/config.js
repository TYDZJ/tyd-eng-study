/**
 * 导入脚本配置（CommonJS）
 * 可通过环境变量覆盖路径与条数。
 */

const path = require("path");

/**
 * 词库根目录：默认与 tyd-eng-study 仓库同级的 english-vocabulary-master
 * （本文件位于 scripts/import/lib，需向上 4 级到 order/）
 */
const DEFAULT_VOCAB_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "english-vocabulary-master",
);

const VOCAB_ROOT = process.env.ENGLISH_VOCAB_ROOT || DEFAULT_VOCAB_ROOT;

/**
 * 每本词书截取条数：
 * - IMPORT_WORD_LIMIT=0 或不传：全量
 * - IMPORT_WORD_LIMIT>0：按指定条数截取（用于抽样测试）
 */
const parsedLimit = parseInt(process.env.IMPORT_WORD_LIMIT || "0", 10);
const LIMIT =
  Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(50000, parsedLimit)
    : 0;

const CET4_SOURCE = path.join(
  VOCAB_ROOT,
  "json_original",
  "json-sentence",
  "CET4_1.json",
);

const CET6_SOURCE = path.join(
  VOCAB_ROOT,
  "json_original",
  "json-sentence",
  "CET6_1.json",
);

const DATA_DIR = path.join(__dirname, "..", "data");

module.exports = {
  VOCAB_ROOT,
  LIMIT,
  CET4_SOURCE,
  CET6_SOURCE,
  DATA_DIR,
  OUT_BOOKS: path.join(DATA_DIR, "books.json"),
  OUT_WORDS: path.join(DATA_DIR, "words.json"),
  OUT_BOOK_WORDS_CET4: path.join(DATA_DIR, "book_words_cet4.json"),
  OUT_BOOK_WORDS_CET6: path.join(DATA_DIR, "book_words_cet6.json"),
};
