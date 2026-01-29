# Still Grateful API

A Cloudflare Worker backend for an anonymous gratitude messaging app.

## Overview

Still Grateful allows users to send anonymous gratitude messages to people who have made a difference in their lives. The API handles:

- **Receiving messages** from the iOS app
- **Filtering for safety** using Google's Gemini 3 Flash Preview
- **Delivering via email** using Resend
- **Rate limiting** to prevent abuse
- **Logging** (without storing message content) for analytics

## Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Email**: Resend API
- **LLM Filtering**: Google Gemini API (gemini-3-flash-preview)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
wrangler d1 create stillgrateful-db
```

Copy the returned `database_id` and update it in `wrangler.jsonc`.

### 3. Run Migrations

```bash
wrangler d1 execute stillgrateful-db --local --file=./migrations/0001_initial_schema.sql
```

For production:

```bash
wrangler d1 execute stillgrateful-db --remote --file=./migrations/0001_initial_schema.sql
```

### 4. Configure Secrets

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put RESEND_API_KEY
```

### 5. Configure Domain (Optional)

Update the `routes` in `wrangler.jsonc` if using a different domain.

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Deployment

```bash
npm run deploy
```

## API Reference

### POST /send

Send an anonymous gratitude message.

**Request Body:**

```json
{
  "message": "Thank you for being such a wonderful mentor...",
  "recipient_email": "recipient@example.com",
  "context_tag": "mentor",
  "sender_token": "unique-anonymous-token"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | The gratitude message (max 2000 chars) |
| `recipient_email` | string | Valid email address |
| `context_tag` | string | One of: `former-student`, `former-teacher`, `old-friend`, `former-colleague`, `former-teammate`, `family-member`, `mentor`, `other` |
| `sender_token` | string | Anonymous unique token for rate limiting (generated client-side) |

**Success Response (200):**

```json
{
  "success": true
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `validation_error` | Invalid input data |
| 400 | `message_rejected` | Message failed content filter |
| 429 | `rate_limited` | Too many messages sent (5/day limit) |
| 500 | `server_error` | Email delivery failed |

**Example Error:**

```json
{
  "success": false,
  "error": "message_rejected",
  "reason": "This message doesn't appear to be expressing gratitude."
}
```

## Privacy

- Message content is **never stored** in the database
- Only the sender hash, recipient domain, context tag, and status are logged
- Sender tokens are hashed before storage
- Full recipient email addresses are not stored (only the domain)

## Rate Limiting

- Maximum 5 messages per 24-hour window per sender token
- Rate limit resets 24 hours after the first send in the window

## Content Filtering

Messages are filtered using Google's Gemini 3 Flash Preview to ensure they are genuine expressions of gratitude. The filter rejects:

- Insults, sarcasm, or passive-aggressive tone
- Threats or harassment
- Romantic or sexual content
- Requests for a response or contact
- Backhanded compliments
- Criticism disguised as thanks
- Spam or promotional content

If the Gemini API is unavailable, messages are rejected (fail-safe behavior).
