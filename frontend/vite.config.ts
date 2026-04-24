import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
  },
  preview: {
    allowedHosts: ["frontend-production-d580.up.railway.app", "pickypaws.app"],
    host: true,
    port: Number.parseInt(process.env.PORT ?? "3000", 10),
    strictPort: true,
  },
});
