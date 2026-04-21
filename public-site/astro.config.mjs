import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  vite: {
    ssr: {
      external: ['@opentelemetry/api', 'kysely'],
    },
  },
  integrations: [react()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  site: 'https://auto-research.linnefromice.workers.dev',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
