import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					bindings: {
						GEMINI_API_KEY: 'test-gemini-key',
						RESEND_API_KEY: 'test-resend-key',
					},
					d1Databases: {
						DB: 'stillgrateful-test-db',
					},
				},
			},
		},
	},
});
