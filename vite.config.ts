import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./src"), // "@/Foo" → "src/Foo"
      "@components/": path.resolve(__dirname, "./src/components"),
    },
  },
});
