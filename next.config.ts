import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that should be required at runtime instead of being
  // bundled (undici ships its own dispatcher internals; the parsers are large
  // CJS/ESM hybrids that the bundler does not need to process).
  serverExternalPackages: ["undici", "unpdf", "mammoth", "xlsx"],
};

export default nextConfig;
