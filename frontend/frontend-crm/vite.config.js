import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
   plugins: [react()],
   resolve: {
      alias: {
         "@common": path.resolve(__dirname, "../common-components"),
      },
   },
   server: {
      port: 5174,
      host: true,
      fs: {
         allow: [".."],
      },
   },
   optimizeDeps: {
      include: ["jose", "js-cookie"],
   },
});
