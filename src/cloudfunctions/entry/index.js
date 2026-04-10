const cloud = require("wx-server-sdk");

cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV,
});

/**
 * 云函数入口：可按 event.action 做简单路由，或拆分为多个云函数
 * @param {object} event 小程序 callFunction 传入的 data
 * @param {object} context 调用上下文
 */
exports.main = async (event, context) => {
	const wxContext = cloud.getWXContext();

	return {
		errMsg: "ok",
		openid: wxContext.OPENID,
		appid: wxContext.APPID,
		event,
	};
};
