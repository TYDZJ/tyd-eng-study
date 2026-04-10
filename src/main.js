import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import uviewPlus from "uview-plus";
import App from "./App.vue";
import { createPersistPlugin } from "./plugins/pinia-persist";

export function createApp() {
	const app = createSSRApp(App);
	const pinia = createPinia();
	pinia.use(createPersistPlugin());
	app.use(pinia);
	app.use(uviewPlus);
	return {
		app,
	};
}
