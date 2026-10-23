import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen runs in the browser, so the app builds to plain files in out/ for Firebase Hosting.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
