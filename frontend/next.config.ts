import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DECISION: Disable StrictMode in dev — StrictMode double-invokes effects and
  // callbacks to surface side-effects, which caused startCall to fire twice,
  // dispatching two agents to the same room.
  reactStrictMode: false,
};

export default nextConfig;
