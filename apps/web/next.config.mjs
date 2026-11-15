import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(projectRoot, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // The hub is reached by host, so a local visit needs a second name beside `localhost`:
  // `/etc/hosts` maps it to 127.0.0.1 and this lets the dev server serve its chunks there.
  allowedDevOrigins: ["status.mooncellar.test", "api.mooncellar.test"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  // Keep on-demand ISR pages in memory only, see cache-handler.cjs.
  cacheHandler: join(projectRoot, "cache-handler.cjs"),
  cacheMaxMemorySize: 256 * 1024 * 1024,
  sassOptions: {
    loadPaths: [join(projectRoot, "src/lib/app/styles")],
    additionalData: '@use "@/src/lib/app/styles/index.scss" as *;',
  },
  async rewrites() {
    const isStatusHost = [{ type: "host", value: "status\\..+" }];
    const segment =
      "(?!(?:_next|images|img|api|status|worker\\.js|sw\\.js|offline\\.html|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|hub-connector\\.zip)(?:/|$))[^/]+";
    return {
      beforeFiles: [
        { source: "/", has: isStatusHost, destination: "/status" },
        {
          source: `/:first(${segment})`,
          has: isStatusHost,
          destination: "/status/:first",
        },
        {
          source: `/:first(${segment})/:second`,
          has: isStatusHost,
          destination: "/status/:first/:second",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/_next/static/media/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  images: {
    // Defaults to half of the free disk space at startup.
    maximumDiskCacheSize: 2 * 1024 * 1024 * 1024,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.igdb.com",
      },
      {
        protocol: "https",
        hostname: "images7.alphacoders.com",
      },
      {
        protocol: "https",
        hostname: "static.retroachievements.org",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3228",
      },
      {
        protocol: "https",
        hostname: "api.mooncellar.space",
      },
      {
        protocol: "https",
        hostname: "media.retroachievements.org",
      },
      {
        protocol: "https",
        hostname: "mooncellar-*.s3.regru.cloud",
      },
      {
        protocol: "https",
        hostname: "s3.regru.cloud",
      },
      {
        protocol: "https",
        hostname: "*.sfo3.cdn.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "*.sfo3.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "t.vndb.org",
      },
      {
        protocol: "https",
        hostname: "shared.akamai.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "howlongtobeat.com",
      },
    ],
  },
};

export default nextConfig;
