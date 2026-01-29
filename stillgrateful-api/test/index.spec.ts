import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';

// Typed request helper
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Mock fetch for external API calls
const originalFetch = globalThis.fetch;

/**
 * Creates a valid send request body
 */
function createValidSendRequest(overrides: Record<string, unknown> = {}) {
	return {
		message: 'Thank you for being such a wonderful mentor. Your guidance changed my life.',
		recipient_email: 'recipient@example.com',
		context_tag: 'mentor',
		sender_token: 'unique-anonymous-token-123',
		...overrides,
	};
}

/**
 * Creates a mock response for Gemini API
 */
function createGeminiMockResponse(decision: 'ALLOW' | 'REJECT') {
	return new Response(
		JSON.stringify({
			candidates: [{ content: { parts: [{ text: decision }] } }],
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

/**
 * Creates a mock response for Resend API
 */
function createResendMockResponse() {
	return new Response(
		JSON.stringify({ id: 'email-id-123' }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

describe('Still Grateful API', () => {
	beforeEach(() => {
		// Reset fetch mock before each test
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe('CORS', () => {
		it('handles OPTIONS preflight requests', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'OPTIONS',
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(204);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});
	});

	describe('Routing', () => {
		it('returns 404 for non-existent routes', async () => {
			const request = new IncomingRequest('http://example.com/nonexistent');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});

		it('returns 404 for GET requests to /send', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'GET',
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});
	});

	describe('Input Validation', () => {
		it('rejects requests with invalid JSON', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: 'not-valid-json',
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('validation_error');
		});

		it('rejects requests missing required fields', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify({ message: 'Hello' }), // Missing other required fields
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('validation_error');
		});

		it('rejects messages exceeding 2000 characters', async () => {
			const longMessage = 'a'.repeat(2001);
			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({ message: longMessage })),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const json = await response.json() as { success: boolean; error: string; reason: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('validation_error');
			expect(json.reason).toContain('2000');
		});

		it('rejects invalid email formats', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({ recipient_email: 'not-an-email' })),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('validation_error');
		});

		it('rejects invalid context tags', async () => {
			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({ context_tag: 'invalid-tag' })),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('validation_error');
		});

		it('accepts all valid context tags', async () => {
			const validTags = [
				'former-student',
				'former-teacher',
				'old-friend',
				'former-colleague',
				'former-teammate',
				'family-member',
				'mentor',
				'other',
			];

			// Mock successful external API calls
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
				if (url.includes('generativelanguage.googleapis.com')) {
					return Promise.resolve(createGeminiMockResponse('ALLOW'));
				}
				if (url.includes('resend.com')) {
					return Promise.resolve(createResendMockResponse());
				}
				return Promise.resolve(new Response('Not Found', { status: 404 }));
			});

			// Just validate that the tags are accepted (past validation stage)
			for (const tag of validTags) {
				const request = new IncomingRequest('http://example.com/send', {
					method: 'POST',
					body: JSON.stringify(createValidSendRequest({ 
						context_tag: tag,
						sender_token: `token-for-${tag}-${Date.now()}` // Unique token to avoid rate limits
					})),
					headers: { 'Content-Type': 'application/json' },
				});
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				const json = await response.json() as { success: boolean; error?: string };
				// If validation passed, we should get success or a non-validation error
				expect(json.error).not.toBe('validation_error');
			}
		});
	});

	describe('LLM Filtering', () => {
		it('rejects messages that fail LLM filter', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
				if (url.includes('generativelanguage.googleapis.com')) {
					return Promise.resolve(createGeminiMockResponse('REJECT'));
				}
				return Promise.resolve(new Response('Not Found', { status: 404 }));
			});

			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({
					message: 'This is actually a passive-aggressive message.',
					sender_token: 'filter-test-token-reject',
				})),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			const json = await response.json() as { success: boolean; error: string; reason: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('message_rejected');
			expect(json.reason).toContain('gratitude');
		});

		it('rejects messages when Gemini API fails', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
				if (url.includes('generativelanguage.googleapis.com')) {
					return Promise.resolve(new Response('Internal Server Error', { status: 500 }));
				}
				return Promise.resolve(new Response('Not Found', { status: 404 }));
			});

			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({
					sender_token: 'filter-test-token-api-fail',
				})),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			// Should fail safely, not send unfiltered messages
			expect(json.error).toBe('message_rejected');
		});
	});

	describe('Email Sending', () => {
		it('sends email successfully and returns success', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
				if (url.includes('generativelanguage.googleapis.com')) {
					return Promise.resolve(createGeminiMockResponse('ALLOW'));
				}
				if (url.includes('resend.com')) {
					return Promise.resolve(createResendMockResponse());
				}
				return Promise.resolve(new Response('Not Found', { status: 404 }));
			});

			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({
					sender_token: 'email-test-token-success',
				})),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const json = await response.json() as { success: boolean };
			expect(json.success).toBe(true);
		});

		it('returns server error when email sending fails', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
				if (url.includes('generativelanguage.googleapis.com')) {
					return Promise.resolve(createGeminiMockResponse('ALLOW'));
				}
				if (url.includes('resend.com')) {
					return Promise.resolve(new Response('Email Service Error', { status: 500 }));
				}
				return Promise.resolve(new Response('Not Found', { status: 404 }));
			});

			const request = new IncomingRequest('http://example.com/send', {
				method: 'POST',
				body: JSON.stringify(createValidSendRequest({
					sender_token: 'email-test-token-fail',
				})),
				headers: { 'Content-Type': 'application/json' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
			const json = await response.json() as { success: boolean; error: string };
			expect(json.success).toBe(false);
			expect(json.error).toBe('server_error');
		});
	});
});

