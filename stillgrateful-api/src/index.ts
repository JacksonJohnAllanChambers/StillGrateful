/**
 * Still Grateful API
 * 
 * A Cloudflare Worker backend for an anonymous gratitude messaging app.
 * Handles receiving gratitude messages, filtering them for safety using an LLM,
 * and delivering them via email.
 */

import type { Env, SendRequest, ApiResponse, ContextTag, SendStatus } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum allowed message length */
const MAX_MESSAGE_LENGTH = 2000;

/** Maximum sends allowed per rate limit window */
const MAX_SENDS_PER_WINDOW = 5;

/** Rate limit window duration in hours */
const RATE_LIMIT_WINDOW_HOURS = 24;

/** Allowed context tags */
const VALID_CONTEXT_TAGS: ContextTag[] = [
	'former-student',
	'former-teacher',
	'old-friend',
	'former-colleague',
	'former-teammate',
	'family-member',
	'mentor',
	'other',
];

/** Human-readable display names for context tags */
const CONTEXT_TAG_DISPLAY_NAMES: Record<ContextTag, string> = {
	'former-student': 'A former student',
	'former-teacher': 'A former teacher',
	'old-friend': 'An old friend',
	'former-colleague': 'A former colleague',
	'former-teammate': 'A former teammate',
	'family-member': 'A family member',
	'mentor': 'A mentor',
	'other': 'Someone from your past',
};

/** System prompt for LLM content filtering */
const FILTER_SYSTEM_PROMPT = `You are a permissive content filter for an anonymous gratitude app. Your default is to ALLOW messages. People use this app to thank teachers, mentors, friends, and family members who impacted their lives.

ONLY REJECT a message if it clearly contains:
- Direct threats, harassment, or violent language
- Explicit sexual content
- Obvious spam or promotional content
- Clear abuse or hate speech

ALLOW messages that:
- Express thanks, appreciation, or gratitude (even if brief or simple)
- Share positive memories or impacts someone had
- Are heartfelt, even if imperfectly written
- Mention how someone helped or influenced them
- Are nostalgic or sentimental

When in doubt, ALLOW the message. This app is meant to spread kindness.

Respond with exactly one word: ALLOW or REJECT`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a JSON response with proper headers
 */
function jsonResponse(data: ApiResponse, status: number = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

/**
 * Creates an error response
 */
function errorResponse(
	error: 'message_rejected' | 'rate_limited' | 'validation_error' | 'server_error',
	reason: string,
	status: number = 400
): Response {
	return jsonResponse({ success: false, error, reason }, status);
}

/**
 * Hashes a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts the domain from an email address
 */
function extractDomain(email: string): string {
	const parts = email.split('@');
	return parts.length > 1 ? parts[1].toLowerCase() : '';
}

/**
 * Validates an email address format
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validates if a string is a valid context tag
 */
function isValidContextTag(tag: string): tag is ContextTag {
	return VALID_CONTEXT_TAGS.includes(tag as ContextTag);
}

// ============================================================================
// Core Logic Functions
// ============================================================================

/**
 * Validates the incoming request body
 */
function validateRequest(body: unknown): { valid: true; data: SendRequest } | { valid: false; reason: string } {
	if (!body || typeof body !== 'object') {
		return { valid: false, reason: 'Request body must be a JSON object.' };
	}

	const data = body as Record<string, unknown>;

	// Check required fields
	if (typeof data.message !== 'string' || !data.message.trim()) {
		return { valid: false, reason: 'Message is required and must be a non-empty string.' };
	}

	if (typeof data.recipient_email !== 'string' || !data.recipient_email.trim()) {
		return { valid: false, reason: 'Recipient email is required.' };
	}

	if (typeof data.context_tag !== 'string' || !data.context_tag.trim()) {
		return { valid: false, reason: 'Context tag is required.' };
	}

	if (typeof data.sender_token !== 'string' || !data.sender_token.trim()) {
		return { valid: false, reason: 'Sender token is required.' };
	}

	// Validate message length
	if (data.message.length > MAX_MESSAGE_LENGTH) {
		return { valid: false, reason: `Message must be ${MAX_MESSAGE_LENGTH} characters or less.` };
	}

	// Validate email format
	if (!isValidEmail(data.recipient_email)) {
		return { valid: false, reason: 'Invalid email address format.' };
	}

	// Validate context tag
	if (!isValidContextTag(data.context_tag)) {
		return {
			valid: false,
			reason: `Invalid context tag. Must be one of: ${VALID_CONTEXT_TAGS.join(', ')}.`,
		};
	}

	return {
		valid: true,
		data: {
			message: data.message.trim(),
			recipient_email: data.recipient_email.trim().toLowerCase(),
			context_tag: data.context_tag as ContextTag,
			sender_token: data.sender_token.trim(),
		},
	};
}

/**
 * Checks and updates rate limit for a sender
 * Returns true if the request is allowed, false if rate limited
 */
async function checkRateLimit(db: D1Database, senderHash: string): Promise<boolean> {
	const windowStart = new Date();
	windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);
	const windowStartStr = windowStart.toISOString().replace('T', ' ').slice(0, 19);

	// Get current rate limit record
	const record = await db
		.prepare('SELECT send_count, window_start FROM rate_limits WHERE sender_hash = ?')
		.bind(senderHash)
		.first<{ send_count: number; window_start: string }>();

	if (!record) {
		// No record exists, create one
		await db
			.prepare('INSERT INTO rate_limits (sender_hash, send_count, window_start) VALUES (?, 1, datetime(\'now\'))')
			.bind(senderHash)
			.run();
		return true;
	}

	// Check if window has expired
	if (record.window_start < windowStartStr) {
		// Reset the window
		await db
			.prepare('UPDATE rate_limits SET send_count = 1, window_start = datetime(\'now\') WHERE sender_hash = ?')
			.bind(senderHash)
			.run();
		return true;
	}

	// Check if under limit
	if (record.send_count < MAX_SENDS_PER_WINDOW) {
		// Increment count
		await db
			.prepare('UPDATE rate_limits SET send_count = send_count + 1 WHERE sender_hash = ?')
			.bind(senderHash)
			.run();
		return true;
	}

	// Rate limited
	return false;
}

/**
 * Filters message content using Google Gemini 2.0 Flash
 * Returns true if the message is allowed, false if rejected
 */
async function filterMessage(message: string, apiKey: string): Promise<boolean> {
	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					contents: [
						{
							role: 'user',
							parts: [{ text: `${FILTER_SYSTEM_PROMPT}\n\nMessage to evaluate:\n"${message}"` }],
						},
					],
					generationConfig: {
						maxOutputTokens: 10,
						temperature: 0,
					},
				}),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Gemini API error:', response.status, errorText);
			// On API error, ALLOW to avoid blocking legitimate messages
			return true;
		}

		const data = await response.json() as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		};

		const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
		console.log('Gemini filter response:', content, 'for message:', message.substring(0, 50));
		
		// Allow if response contains ALLOW, or if we can't parse the response (fail open)
		if (!content) {
			console.log('No content in Gemini response, allowing message');
			return true;
		}
		
		// Only reject if explicitly REJECT
		return !content.includes('REJECT');
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		// On error, ALLOW - don't block users due to API issues
		return true;
	}
}

/**
 * Sends email via Resend API
 */
async function sendEmail(
	recipientEmail: string,
	contextTag: ContextTag,
	message: string,
	apiKey: string
): Promise<boolean> {
	const displayName = CONTEXT_TAG_DISPLAY_NAMES[contextTag];
	
	const plainTextBody = `From: ${displayName}

${message}

---

This message was sent anonymously through Still Grateful, a service for expressing gratitude without social pressure.

No reply is expected or possible. The sender chose to remain anonymous.

Learn more at stillgrateful.app`;

	const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="color: #666; margin-bottom: 8px;">From: <strong>${displayName}</strong></p>
  
  <div style="background-color: #f9f9f9; border-left: 4px solid #4a9c6d; padding: 20px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
  </div>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #888; font-size: 14px;">
    This message was sent anonymously through <a href="https://stillgrateful.app" style="color: #4a9c6d; text-decoration: none;">Still Grateful</a>, a service for expressing gratitude without social pressure.
  </p>
  
  <p style="color: #888; font-size: 14px;">
    No reply is expected or possible. The sender chose to remain anonymous.
  </p>
  
  <p style="color: #888; font-size: 14px;">
    <a href="https://stillgrateful.app" style="color: #4a9c6d; text-decoration: none;">Learn more at stillgrateful.app</a>
  </p>
</body>
</html>`;

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: 'Still Grateful <hello@stillgrateful.app>',
				to: [recipientEmail],
				subject: 'Someone is grateful for you',
				text: plainTextBody,
				html: htmlBody,
			}),
		});

		const responseText = await response.text();
		console.log('Resend API response:', response.status, responseText);

		if (!response.ok) {
			console.error('Resend API error:', response.status, responseText);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error calling Resend API:', error);
		return false;
	}
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
	const htmlEscapes: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	};
	return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Logs a send attempt to the database
 */
async function logSend(
	db: D1Database,
	senderHash: string,
	recipientDomain: string,
	contextTag: ContextTag,
	status: SendStatus
): Promise<void> {
	try {
		await db
			.prepare(
				'INSERT INTO sends (sender_hash, recipient_domain, context_tag, status) VALUES (?, ?, ?, ?)'
			)
			.bind(senderHash, recipientDomain, contextTag, status)
			.run();
	} catch (error) {
		console.error('Error logging send:', error);
		// Don't throw - logging failure shouldn't break the request
	}
}

// ============================================================================
// Main Handler
// ============================================================================

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			// Handle CORS preflight
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'POST, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
						'Access-Control-Max-Age': '86400',
					},
				});
			}

			// Only handle POST /send
			if (request.method !== 'POST' || url.pathname !== '/send') {
				return new Response('Not Found', { status: 404 });
			}

			// Parse request body
			let body: unknown;
			try {
				body = await request.json();
			} catch {
				return errorResponse('validation_error', 'Invalid JSON in request body.');
			}

			// Step 1: Validate input
			const validation = validateRequest(body);
			if (!validation.valid) {
				return errorResponse('validation_error', validation.reason);
			}

			const { message, recipient_email, context_tag, sender_token } = validation.data;
			const senderHash = await hashString(sender_token);
			const recipientDomain = extractDomain(recipient_email);

			// Step 2: Check rate limit
			const withinRateLimit = await checkRateLimit(env.DB, senderHash);
			if (!withinRateLimit) {
				await logSend(env.DB, senderHash, recipientDomain, context_tag, 'rejected');
				return errorResponse(
					'rate_limited',
					"You've sent too many messages today. Please try again tomorrow.",
					429
				);
			}

			// Step 3: Filter message with LLM
			const isAllowed = await filterMessage(message, env.GEMINI_API_KEY);
			if (!isAllowed) {
				await logSend(env.DB, senderHash, recipientDomain, context_tag, 'rejected');
				return errorResponse(
					'message_rejected',
					"This message doesn't appear to be expressing gratitude."
				);
			}

			// Step 4: Send email
			const emailSent = await sendEmail(recipient_email, context_tag, message, env.RESEND_API_KEY);
			if (!emailSent) {
				await logSend(env.DB, senderHash, recipientDomain, context_tag, 'error');
				return errorResponse(
					'server_error',
					'Failed to send email. Please try again later.',
					500
				);
			}

			// Step 5: Log successful send
			await logSend(env.DB, senderHash, recipientDomain, context_tag, 'sent');

			// Step 6: Return success
			return jsonResponse({ success: true });
		} catch (error) {
			console.error('Unhandled error in worker:', error);
			return errorResponse('server_error', `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
		}
	},
} satisfies ExportedHandler<Env>;

