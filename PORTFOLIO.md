# Still Grateful

**An anonymous gratitude messaging platform — from idea to production in 2 hours.**

[stillgrateful.app](https://stillgrateful.app)

---

## The Story

**9:00 AM** — An idea: *What if people could anonymously thank someone who shaped their life — a teacher, mentor, old friend — without the social pressure of expecting a response?*

**11:00 AM** — The app is live. Real users. Real gratitude. Shipping.

This is what modern development looks like when you combine clear vision, the right tools, and AI-accelerated engineering.

---

## What It Does

Still Grateful lets anyone send an anonymous message of appreciation. No account required. No reply expected. Just gratitude, delivered.

**For senders:** Write a heartfelt message, enter the recipient's email, and send. You remain anonymous — they just know it's from "a former student" or "an old friend."

**For recipients:** An unexpected email arrives. Someone from their past — they'll never know exactly who — took a moment to say thank you.

---

## The Technical Stack

A deliberately minimal architecture, optimized for speed, cost, and reliability.

### Frontend
- **Single HTML file** (~600 lines) — no build step, no framework overhead
- **Vanilla JavaScript** — form handling, validation, state management
- **Google Fonts** (Merriweather + Inter) for warmth and readability
- **Mobile-first responsive design**
- **Cloudflare Pages** for edge-cached static hosting

### Backend
- **Cloudflare Workers** — TypeScript, serverless, globally distributed
- **Cloudflare D1** (SQLite at the edge) — rate limiting, analytics logging
- **Google Gemini API** — LLM-powered content filtering for safety
- **Resend API** — transactional email delivery

### Infrastructure
- **Zero servers** — fully serverless
- **Edge-first** — runs in 300+ data centers worldwide
- **Privacy-preserving** — message content is never stored, only hashed tokens and metadata

---

## Architecture Highlights

### Intelligent Content Filtering

Every message passes through a Gemini-powered filter before delivery. The system is tuned to be **permissive by default** — the goal is spreading kindness, not gatekeeping. Only clear abuse, threats, or spam get blocked.

```
"You are a permissive content filter for an anonymous gratitude app. 
Your default is to ALLOW messages..."
```

### Privacy by Design

- Sender tokens are SHA-256 hashed before storage
- Message content is **never persisted** — only passed through, filtered, and sent
- Only recipient domains (not full emails) are logged for analytics
- Rate limiting prevents abuse without tracking individual users

### Rate Limiting

Simple but effective: 5 messages per 24-hour window per device, enforced via D1.

---

## The Numbers

| Metric | Value |
|--------|-------|
| **Development time** | 2 hours |
| **Total API costs** | ~$3 |
| **Lines of backend code** | ~500 |
| **Lines of frontend code** | ~600 |
| **External dependencies** | 1 (OpenAI SDK for Gemini) |
| **Build step** | None |
| **Monthly hosting cost** | $0 (free tier) |

---

## AI-Accelerated, Human-Directed

This project was built solo, with AI as a force multiplier — not a replacement for decision-making.

**What AI handled:**
- Boilerplate generation (TypeScript types, SQL migrations)
- CSS styling from design descriptions
- Error handling edge cases
- Documentation drafts

**What required human judgment:**
- Product vision and scope decisions
- Architecture choices (why D1 over KV, why serverless)
- Content filter prompt engineering (balancing safety vs. over-moderation)
- The "feel" — warm typography, soft colors, the right words

The result: a polished, production-ready app that would traditionally take days or weeks, delivered in a morning — for about the cost of a coffee.

---

## Lessons Learned

1. **Constraints breed creativity.** Two hours forced ruthless prioritization. No auth system. No user accounts. No reply feature. Just the core loop: write → filter → send.

2. **The edge is the new default.** Cloudflare's stack (Workers + D1 + Pages) means global distribution with zero configuration. A user in Tokyo and a user in Toronto both get sub-100ms latency.

3. **AI changes the calculus.** The cost of exploring ideas has dropped dramatically. A $3 experiment that ships is worth more than a $10,000 project that stays in planning.

4. **Simplicity ships.** One HTML file. One Worker. One database table for rate limits, one for logs. No framework. No build pipeline. Just code that runs.

---

## Built With

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| Hosting | Cloudflare Pages |
| API | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Email | Resend |
| Content Filter | Google Gemini 3 Flash |
| Domain | stillgrateful.app |

---

## Try It

Visit [stillgrateful.app](https://stillgrateful.app) and thank someone who shaped you.

---

*Solo project by Jackson Chambers • January 2026*
