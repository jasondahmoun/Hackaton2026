import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
   plugins: [react()],
   resolve: {
      alias: {
         "@common": path.resolve(__dirname, "../common-components"),
         "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
         "jose": path.resolve(__dirname, "node_modules/jose"),
         "js-cookie": path.resolve(__dirname, "node_modules/js-cookie"),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
   },
   server: {
      port: 5174,
      host: true,
      fs: {
         allow: [".."],
      },
      proxy: {
         "/documents": "http://localhost:8000",
         "/uploads": "http://localhost:8000",
      },
   },
   optimizeDeps: {
      include: ["jose", "js-cookie"],
   },
});
