const dayjs = require("dayjs");

exports.main = async () => {
	const now = dayjs();
	const payload = {
		message: "依赖加载成功(dayjs)",
		serverTimeISO: now.toISOString(),
		serverTimeFormat: now.format("YYYY-MM-DD HH:mm:ss"),
	};
	console.log("[dep-test]", payload.message, payload.serverTimeISO);
	return payload;
};
