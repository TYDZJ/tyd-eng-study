<script>
// #ifdef MP-WEIXIN
import { WX_CLOUD_ENV_ID } from "./config/wx-cloud.js";
// #endif

export default {
	onLaunch: function () {
		// #ifdef MP-WEIXIN
		if (typeof wx !== "undefined" && wx.cloud && true) {
			wx.cloud.init({
				env: WX_CLOUD_ENV_ID,
				traceUser: true,
			});
			// wx.cloud
			// 	.callFunction({ name: "ping", data: {} })
			// 	.then((res) => {
			// 		const r = res.result || {};
			// 		const line = `${r.message} | 服务端时间(ISO): ${r.serverTimeISO} | 东八区: ${r.serverTimeLocal}`;
			// 		console.log("[云函数 ping]", line, r);
			// 	})
			// 	.catch((err) => {
			// 		console.error("[云函数 ping] 调用失败（需在微信开发者工具中上传并部署 ping 云函数）", err);
			// 	});
			// wx.cloud
			// 	.callFunction({ name: "dep-test", data: {} })
			// 	.then((res) => {
			// 		const r = res.result || {};
			// 		const line = `${r.message} | ISO: ${r.serverTimeISO} | 格式化: ${r.serverTimeFormat}`;
			// 		console.log("[云函数 dep-test]", line, r);
			// 	})
			// 	.catch((err) => {
			// 		console.error("[云函数 dep-test] 调用失败（请检查依赖安装/部署方式）", err);
			// 	});
		}
		// #endif
		console.log("App Launch");
	},
	onShow: function () {
		console.log("App Show");
	},
	onHide: function () {
		console.log("App Hide");
	},
};
</script>

<style lang="scss">
/*每个页面公共css */
@import "uview-plus/index.scss";
view {
	box-sizing: border-box;
}
</style>
