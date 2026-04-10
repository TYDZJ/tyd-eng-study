import { defineStore } from "pinia";
import { ref } from "vue";

/** 示例：开启 persist 的 store，可按需删除或改名 */
export const useAppStore = defineStore(
	"app",
	() => {
		const token = ref("");
		function setToken(value) {
			token.value = value || "";
		}
		return { token, setToken };
	},
	{
		persist: true,
	},
);
