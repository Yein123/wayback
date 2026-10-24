import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen runs in the browser, so the app builds to plain files in out/ for Firebase Hosting.
  output: "export",
  turbopack: {
    // OpenCV (for the sign reader) comes from the CDN at run time; see lib/opencv.ts.
    resolveAlias: {
      "@techstark/opencv-js": "./lib/opencv.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
