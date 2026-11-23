# Nonprofit Star

Static site plus a tiny local API. Zero npm dependencies; Node 24+.

```
npm run dev     # build into dist/ and serve http://localhost:8787
npm run check   # build, then check JSON-LD, headings, titles, palette, sitemap
```

## Environment variables (all optional)

| Variable | What it does |
| --- | --- |
| `SITE_ORIGIN` | Absolute site URL used in canonical links, JSON-LD, sitemap and llms.txt. Default `http://localhost:8787`. |
| `GOOGLE_MAPS_EMBED_KEY` | Maps Embed API key for the newsletter page map. Restrict it to your domain in Google Cloud. Without it the page uses Google's keyless embed. Never commit the key. |
| `PORT` | Local server port. Default 8787. |

Example: `SITE_ORIGIN=https://nonprofitstar.example GOOGLE_MAPS_EMBED_KEY=... npm run build`
