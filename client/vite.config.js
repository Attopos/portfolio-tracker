import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const clientPort = Number(env.CLIENT_PORT) || 5173;
  const backendUrl = String(env.BACKEND_URL || "http://localhost:3000").trim();

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: clientPort,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
