/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    useTypeScriptCli: true,
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://ryadgenkvhgxjdyhbyqc.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  async rewrites() {
    return [
      {
        source: "/_api/:path*",
        destination: "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
