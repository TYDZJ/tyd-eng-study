import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plugins = [uni()];

// #ifdef MP-WEIXIN
/** 微信小程序：将 src/cloudfunctions 复制到编译输出（与 manifest cloudfunctionRoot 一致） */
function copyCloudFunctionsPlugin() {
  let outDir = "";
  return {
    name: "copy-cloudfunctions",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (!outDir) return;
      const from = path.join(__dirname, "src", "cloudfunctions");
      const to = path.join(outDir, "cloudfunctions");
      if (fs.existsSync(from)) {
        fs.copySync(from, to);
      }
    },
  };
}

plugins.push(copyCloudFunctionsPlugin());
// #endif
// https://vitejs.dev/config/
export default defineConfig({
  plugins,
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["legacy-js-api", "color-functions", "import"],
      },
    },
  },
  optimizeDeps: {
    include: ["uview-plus"],
  },
});
