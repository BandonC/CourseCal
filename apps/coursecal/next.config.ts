import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume the syllabus-parser library from TypeScript source — no build step,
  // no dist/. See COURSECAL.md §5.2.
  transpilePackages: ["@coursecal/syllabus-parser"],
};

export default nextConfig;
