import type { NextConfig } from "next";

// Do not add mapbox-gl to transpilePackages. Transpiling the UMD bundle wraps
// the export so react-map-gl cannot find `Map` and the map stays blank.
const nextConfig: NextConfig = {
  experimental: {
    // Keep recently visited admin tabs in the client router so a second click
    // does not wait on a full RSC round-trip (felt like a 3–6s "redirect").
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
    dynamicOnHover: true,
  },
};

export default nextConfig;
