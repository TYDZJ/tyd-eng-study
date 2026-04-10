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
// #endif

// #ifndef MP-WEIXIN
export function callEntryCloud() {
	return Promise.reject(new Error("callEntryCloud 仅支持微信小程序"));
}
// #endif
