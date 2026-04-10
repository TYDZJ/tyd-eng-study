import { createPersistedState } from "pinia-plugin-persistedstate";

/** 与 uni 同步存储对齐，H5/各端小程序通用 */
const uniStorage = {
	getItem(key) {
		try {
			const v = uni.getStorageSync(key);
			if (v === "" || v === undefined || v === null) return null;
			return typeof v === "string" ? v : String(v);
		} catch {
			return null;
		}
	},
	setItem(key, value) {
		uni.setStorageSync(key, value);
	},
};

export function createPersistPlugin() {
	return createPersistedState({
		storage: uniStorage,
	});
}
