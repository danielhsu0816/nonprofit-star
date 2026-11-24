# Nonprofit Star

**Shine where you live.**

Nonprofit Star helps people find nonprofits in their community. Visitors can browse by cause, city, or way to give, then go directly to an organization’s website to volunteer or donate. A regional newsletter highlights local opportunities, and a nonprofit dashboard tracks profile views and website clicks.

## Run locally

Install **Node.js 24 or later**, open a terminal in the folder containing `package.json`, and run:

```sh
npm run dev
```

Open **http://localhost:8787** in your browser. No npm dependencies need to be installed. Press `Ctrl+C` to stop the server.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build the site and start the local server. |
| `npm run build` | Generate the site in `dist/`. |
| `npm run check` | Build the site and validate structured data, headings, page titles, the color palette, and the sitemap. |

## Configuration

All settings are optional for local development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_ORIGIN` | `http://localhost:8787` | Sets the base URL for canonical links, JSON-LD, `sitemap.xml`, and `llms.txt`. Use your public URL when building for deployment. |
| `PORT` | `8787` | Sets the local server port. If you change it, update `SITE_ORIGIN` to match. |
| `GOOGLE_MAPS_EMBED_KEY` | Unset | Configures the newsletter map. The page uses a keyless Google Maps embed by default. |

If you use a Google Maps Embed API key, restrict it to your domain and the Maps Embed API in Google Cloud. Keep the key out of version control.
