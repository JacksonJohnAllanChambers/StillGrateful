# Still Grateful

**Send anonymous gratitude to someone who shaped your life.**

[stillgrateful.app](https://stillgrateful.app)

---

## What is it?

A simple web app that lets you thank a teacher, mentor, friend, or family member — anonymously. No account. No reply expected. Just appreciation, delivered.

## Built in 2 Hours

From idea to production in a single morning. AI-accelerated development with ~$3 in total API costs.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Vanilla HTML/CSS/JS on Cloudflare Pages |
| **API** | Cloudflare Workers (TypeScript) |
| **Database** | Cloudflare D1 (SQLite) |
| **Email** | Resend |
| **Safety Filter** | Google Gemini |

## Project Structure

```
stillgrateful-api/    # Cloudflare Worker backend
stillgrateful-web/    # Static frontend (single HTML file)
```

## Key Features

- 🔒 **Privacy-first** — Messages are never stored, only delivered
- 🌍 **Edge-deployed** — Runs globally on Cloudflare's network
- 🛡️ **AI-filtered** — LLM screens for abuse while staying permissive
- ⚡ **Zero build step** — Just HTML and a Worker

## Local Development

**API:**
```bash
cd stillgrateful-api
npm install
npm run dev
```

**Web:**
```bash
cd stillgrateful-web
npm run dev
```

## License

MIT

---

*Solo project • January 2026*
