/**
 * Still Grateful API - Environment Types
 * 
 * This file defines the environment bindings available to the Worker.
 * Regenerate base types with: npm run cf-typegen
 */

/**
 * Environment bindings for the Still Grateful Worker
 */
export interface Env {
	/**
	 * D1 Database binding for storing sends and rate limits
	 */
	DB: D1Database;

	/**
	 * Google Gemini API key for message filtering (set via wrangler secret put)
	 */
	GEMINI_API_KEY: string;

	/**
	 * Resend API key for sending emails (set via wrangler secret put)
	 */
	RESEND_API_KEY: string;
}

/**
 * Request body for POST /send endpoint
 */
export interface SendRequest {
	/** The gratitude message (max 2000 chars) */
	message: string;
	/** Valid email address of the recipient */
	recipient_email: string;
	/** Relationship context tag */
	context_tag: ContextTag;
	/** Anonymous unique token for rate limiting (generated client-side) */
	sender_token: string;
}

/**
 * Allowed context tags for the relationship between sender and recipient
 */
export type ContextTag =
	| 'former-student'
	| 'former-teacher'
	| 'old-friend'
	| 'former-colleague'
	| 'former-teammate'
	| 'family-member'
	| 'mentor'
	| 'other';

/**
 * API response for successful operations
 */
export interface SuccessResponse {
	success: true;
}

/**
 * API response for failed operations
 */
export interface ErrorResponse {
	success: false;
	error: 'message_rejected' | 'rate_limited' | 'validation_error' | 'server_error';
	reason: string;
}

/**
 * Combined API response type
 */
export type ApiResponse = SuccessResponse | ErrorResponse;

/**
 * Status of a send attempt (for logging)
 */
export type SendStatus = 'sent' | 'rejected' | 'error';
