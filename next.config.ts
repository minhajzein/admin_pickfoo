import type { NextConfig } from "next";

// Do not add mapbox-gl to transpilePackages. Transpiling the UMD bundle wraps
// the export so react-map-gl cannot find `Map` and the map stays blank.
const nextConfig: NextConfig = {};

export default nextConfig;
