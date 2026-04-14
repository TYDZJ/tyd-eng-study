/**
 * 将 scripts/import/data 下 JSON 写入微信云开发数据库。
 *
 * 支持两种认证方式：
 * 1) 腾讯云 API 密钥（TCB_SECRET_ID / TCB_SECRET_KEY）
 * 2) CloudBase CLI 登录态（先执行 cloudbase login）
 *
 * 环境变量：
 *   TCB_ENV_ID      默认读取 src/config/wx-cloud.js 中的环境 ID
 *   TCB_SECRET_ID   腾讯云 SecretId（可选）
 *   TCB_SECRET_KEY  腾讯云 SecretKey（可选）
 *
 * 集合名：books、words、book_words
 *
 * 用法：
 *   npm run import:push
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  OUT_BOOKS,
  OUT_WORDS,
  OUT_BOOK_WORDS_CET4,
  OUT_BOOK_WORDS_CET6,
} = require("./lib/config");

function readWxCloudEnvId() {
  const cfgPath = path.join(__dirname, "..", "..", "src", "config", "wx-cloud.js");
  if (!fs.existsSync(cfgPath)) return "";
  const text = fs.readFileSync(cfgPath, "utf8");
  const m = text.match(/WX_CLOUD_ENV_ID\s*=\s*["']([^"']+)["']/);
  return m ? m[1].trim() : "";
}

async function setDoc(db, collection, id, data) {
  await db.collection(collection).doc(id).set(data);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function buildUpdateCommand(collection, docs) {
  const updates = docs.map((doc) => {
    const { _id, ...rest } = doc;
    return {
      q: { _id },
      u: { $set: rest },
      upsert: true,
      multi: false,
    };
  });
  return JSON.stringify([
    {
      TableName: collection,
      CommandType: "UPDATE",
      Command: JSON.stringify({
        update: collection,
        updates,
      }),
    },
  ]);
}

function runCloudbaseCli(args) {
  const rootDir = path.join(__dirname, "..", "..");
  const localCliScript = path.join(
    rootDir,
    "node_modules",
    "@cloudbase",
    "cli",
    "bin",
    "cloudbase"
  );

  let cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  let argv = ["cloudbase", ...args];
  if (fs.existsSync(localCliScript)) {
    cmd = process.execPath;
    argv = [localCliScript, ...args];
  }

  const ret = spawnSync(cmd, argv, {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env,
  });

  if (ret.status === 0) {
    return (ret.stdout || "").trim();
  }

  const msg = [
    `命令: ${cmd} ${argv.join(" ")}`,
    `exitCode: ${ret.status}`,
    ret.error ? `error: ${ret.error.message}` : "",
    (ret.stderr || "").trim(),
    (ret.stdout || "").trim(),
  ]
    .filter(Boolean)
    .join("\n");
  throw new Error(msg || "CloudBase CLI 执行失败");
}

function pushByCliLogin(envId, collection, docs) {
  const chunks = [];
  const MAX_COMMAND_LEN = 7000;
  let current = [];
  for (const doc of docs) {
    const next = [...current, doc];
    const cmd = buildUpdateCommand(collection, next);
    if (cmd.length > MAX_COMMAND_LEN && current.length > 0) {
      chunks.push(current);
      current = [doc];
    } else {
      current = next;
    }
  }
  if (current.length > 0) chunks.push(current);

  console.log(`${collection} 准备写入: ${docs.length} 条，分 ${chunks.length} 批`);
  for (let i = 0; i < chunks.length; i += 1) {
    const command = buildUpdateCommand(collection, chunks[i]);
    runCloudbaseCli([
      "db",
      "nosql",
      "execute",
      "--env-id",
      envId,
      "--command",
      command,
      "--json",
    ]);
    console.log(`${collection} chunk ${i + 1}/${chunks.length} 已写入`);
  }
}

async function main() {
  const secretId = process.env.TCB_SECRET_ID || "";
  const secretKey = process.env.TCB_SECRET_KEY || "";
  const envId =
    process.env.TCB_ENV_ID || readWxCloudEnvId() || "";

  if (!envId) {
    console.log("未检测到 TCB_ENV_ID，请先设置环境变量或在 src/config/wx-cloud.js 中配置 WX_CLOUD_ENV_ID。");
    process.exit(1);
  }

  const books = JSON.parse(fs.readFileSync(OUT_BOOKS, "utf8"));
  const words = JSON.parse(fs.readFileSync(OUT_WORDS, "utf8"));
  const bw4 = JSON.parse(fs.readFileSync(OUT_BOOK_WORDS_CET4, "utf8"));
  const bw6 = JSON.parse(fs.readFileSync(OUT_BOOK_WORDS_CET6, "utf8"));
  const bookWords = [...bw4, ...bw6];

  console.log("本次导入数据统计:");
  console.log("  books:", books.length);
  console.log("  words:", words.length);
  console.log("  book_words:", bookWords.length);

  if (secretId && secretKey) {
    let cloudbase;
    try {
      cloudbase = require("@cloudbase/node-sdk");
    } catch (e) {
      console.error("请安装依赖: npm i -D @cloudbase/node-sdk");
      process.exit(1);
    }

    const app = cloudbase.init({
      env: envId,
      secretId,
      secretKey,
    });
    const db = app.database();

    for (const b of books) {
      const { _id, ...rest } = b;
      await setDoc(db, "books", _id, rest);
    }
    for (const w of words) {
      const { _id, ...rest } = w;
      await setDoc(db, "words", _id, rest);
    }
    for (const row of bookWords) {
      const { _id, ...rest } = row;
      await setDoc(db, "book_words", _id, rest);
    }
    console.log("已使用腾讯云 API 密钥写入");
    console.log("写入完成条数:");
    console.log("  books:", books.length);
    console.log("  words:", words.length);
    console.log("  book_words:", bookWords.length);
    console.log("push-to-cloud 完成，env:", envId);
    return;
  }

  try {
    runCloudbaseCli(["env", "list", "--env-id", envId, "--json"]);
  } catch (e) {
    console.error("未检测到可用的 CloudBase CLI 登录态，请先执行: npx cloudbase login");
    console.error("或配置 TCB_SECRET_ID / TCB_SECRET_KEY 后重试。");
    console.error(String(e.message || e));
    process.exit(1);
  }

  pushByCliLogin(envId, "books", books);
  pushByCliLogin(envId, "words", words);
  pushByCliLogin(envId, "book_words", bookWords);

  console.log("已使用 CloudBase CLI 登录态写入");
  console.log("写入完成条数:");
  console.log("  books:", books.length);
  console.log("  words:", words.length);
  console.log("  book_words:", bookWords.length);
  console.log("push-to-cloud 完成，env:", envId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
