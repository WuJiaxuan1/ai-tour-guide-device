import base from '../frontend/vite.config.mjs';

// Local-only ports: keep the older MCP demo on 8787 untouched.
export default {
  ...base,
  server: {
    ...base.server,
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {'/api': 'http://127.0.0.1:8790', '/_AMapService': 'http://127.0.0.1:8790'},
  },
};
