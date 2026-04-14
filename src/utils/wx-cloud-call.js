/**
 * 调用云函数 `entry`（需在「云开发」中上传并部署该云函数）
 */

// #ifdef MP-WEIXIN
/**
 * @param {Record<string, unknown>} [data]
 */
export function callEntryCloud(data = {}) {
	return wx.cloud.callFunction({
		name: "entry",
		data,
	});
}

/**
 * 获取学习页待学习词（默认四级 20 词）
 * @param {{ bookId?: string; count?: number }} [params]
 */
export async function getLearnWords(params = {}) {
	const { bookId = "cet4", count = 20 } = params;
	const res = await callEntryCloud({
		action: "getLearnWords",
		book_id: bookId,
		count,
	});
	return res?.result;
}
// #endif

// #ifndef MP-WEIXIN
export function callEntryCloud() {
	return Promise.reject(new Error("callEntryCloud 仅支持微信小程序"));
}

export function getLearnWords() {
	return Promise.reject(new Error("getLearnWords 仅支持微信小程序"));
}
// #endif
