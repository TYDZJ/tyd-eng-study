exports.main = async () => {
	const now = new Date();
	const payload = {
		message: "云函数初始化成功",
		serverTimeISO: now.toISOString(),
		serverTimeLocal: now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
	};
	console.log("[ping]", payload.message, payload.serverTimeISO);
	return payload;
};
