import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run verify:e2e` builds into its own folder so a running `next dev`
  // keeps its `.next` cache untouched.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // postgres.js and @supabase/supabase-js are plain JavaScript bundles.
  experimental: {
    agentUpgrade: "security",
    // Room for the 25 MB upload cap plus multipart overhead.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
