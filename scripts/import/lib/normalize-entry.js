/**
 * 将 json-sentence 单条转为 words 集合文档结构
 */

function dedupePhrases(phrases) {
  const seen = new Set();
  const out = [];
  for (const p of phrases || []) {
    const phrase = String(p.phrase || "").trim();
    const translation = String(p.translation || "").trim();
    if (!phrase && !translation) continue;
    const key = `${phrase}\0${translation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ phrase, translation });
  }
  return out;
}

function dedupeSentences(sentences) {
  const seen = new Set();
  const out = [];
  for (const s of sentences || []) {
    const sentence = String(
      s.sentence || s.sContent || ""
    ).trim();
    const translation = String(
      s.translation || s.sCn || ""
    ).trim();
    if (!sentence && !translation) continue;
    const key = `${sentence}\0${translation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sentence, translation });
  }
  return out;
}

/**
 * @param {object} raw json-sentence 数组元素
 * @returns {object|null} words 文档或 null（无效词条）
 */
function normalizeWordDoc(raw) {
  const w = String(raw.word || "")
    .trim()
    .toLowerCase();
  if (!w) return null;

  const translations = (raw.translations || [])
    .map((t) => ({
      type: String(t.type || "").trim(),
      translation: String(t.translation || "").trim(),
    }))
    .filter((t) => t.translation);

  const phrases = dedupePhrases(raw.phrases);
  const sentences = dedupeSentences(raw.sentences);

  const now = new Date().toISOString();
  return {
    _id: w,
    word: w,
    uk: String(raw.uk || "").trim(),
    us: String(raw.us || "").trim(),
    translations,
    phrases,
    sentences,
    extra: {},
    created_at: now,
    updated_at: now,
  };
}

module.exports = { normalizeWordDoc };
