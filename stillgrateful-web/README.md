# Still Grateful — Website

A simple, warm, single-page website for Still Grateful—an anonymous gratitude messaging service.

## Features

- Clean, minimal, mobile-first design
- Soft, warm color palette (muted greens, warm whites)
- Form to send anonymous gratitude messages
- Client-side validation
- Persistent sender token (stored in localStorage)
- Loading, success, and error states

## Local Development

```bash
npm run dev
```

This starts a local development server at http://localhost:3000

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run deploy
```

Or connect the repository to Cloudflare Pages for automatic deployments.

### Manual Setup in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Pages
2. Create a new project
3. Connect your Git repository or upload directly
4. Set build settings:
   - Build command: (leave empty)
   - Build output directory: `/` (root)
5. Deploy

### Custom Domain

To connect to `stillgrateful.app`:

1. In Cloudflare Pages project settings, go to Custom domains
2. Add `stillgrateful.app`
3. The DNS records will be configured automatically if the domain is on Cloudflare

## API

The form sends POST requests to `https://api.stillgrateful.app/send` with:

```json
{
  "message": "Your gratitude message",
  "recipient_email": "recipient@example.com",
  "context_tag": "former-teacher",
  "sender_token": "uuid-v4-token"
}
```

### Context Tags

| Display Text            | API Value         |
|-------------------------|-------------------|
| A former student        | former-student    |
| A former teacher        | former-teacher    |
| An old friend           | old-friend        |
| A former colleague      | former-colleague  |
| A former teammate       | former-teammate   |
| A family member         | family-member     |
| A mentor                | mentor            |
| Someone from your past  | other             |

## Design

- **Typography**: Merriweather (serif) for headings, Inter (sans-serif) for body
- **Colors**: 
  - Background: #faf9f7 (warm white)
  - Accent: #5c7c6b (muted green)
  - Text: #3d3d3d (soft black)
- **Mobile-first**: Optimized for phone screens
