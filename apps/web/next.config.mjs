/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@branchwork/domain", "@branchwork/graph", "@branchwork/models"],
  reactStrictMode: true,
};

export default nextConfig;
