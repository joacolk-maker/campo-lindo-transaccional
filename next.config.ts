import type { NextConfig } from 'next';

const repository = 'campo-lindo-transaccional';
const isPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? `/${repository}` : '',
  assetPrefix: isPages ? `/${repository}/` : '',
};

export default nextConfig;
