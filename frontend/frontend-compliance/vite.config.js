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
      port: 5173,
      host: true,
      fs: {
         allow: [".."],
      },
      proxy: {
         "/uploads": "http://localhost:8000",
         "/documents": "http://localhost:8000",
      },
   },
   optimizeDeps: {
      include: ["jose", "js-cookie"],
   },
});
