const cloud = require("wx-server-sdk");

cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

async function getLearnWords(event, wxContext) {
	// 测试模式：进入学习页时仅拉取词书前 N 个词，不依赖用户进度表。
	// 后续接正式学习流程时，可恢复 user_book_progress 的 current_seq 游标逻辑。
	const bookId = String(event.book_id || "cet4");
	const count = Math.min(40, Math.max(1, Number(event.count) || 20));
	// 仅用于返回给前端展示，便于未来切换到进度驱动时保持字段兼容。
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
		return {
			code: 0,
			message: "ok",
			data: {
				book_id: bookId,
				current_seq: currentSeq,
				words: [],
			},
		};
	}

	const wordsRes = await db
		.collection("words")
		.where({
			_id: _.in(wordIds),
		})
		.get();

	// where + in 查询返回顺序不保证与 wordIds 一致，需按 book_words 顺序重排。
	const wordsMap = new Map((wordsRes.data || []).map((w) => [w._id, w]));
	const words = bookWords
		.map((row) => wordsMap.get(row.word_id))
		.filter(Boolean);

	return {
		code: 0,
		message: "ok",
		data: {
			book_id: bookId,
			current_seq: currentSeq,
			words,
		},
	};
}

/**
 * 云函数入口：可按 event.action 做简单路由，或拆分为多个云函数
 * @param {object} event 小程序 callFunction 传入的 data
 * @param {object} context 调用上下文
 */
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();
	const action = event && event.action;

	if (action === "getLearnWords") {
		return getLearnWords(event, wxContext);
	}

	return {
		errMsg: "ok",
		openid: wxContext.OPENID,
		appid: wxContext.APPID,
		event,
	};
};
