import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHost = process.env.WEB_ALLOWED_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: allowedHost ? [allowedHost] : [],
  },
});
