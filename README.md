# Shapeshifters · shapeshifters.supply

The store for Affinity templates, brushes, textures and social media packs.
Built with **Astro**, edited in **Pages CMS**, hosted on **Cloudflare Pages**, checkout through **Polar**.

## Run it locally

Needs Node 22.23 or newer.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
```

## What's where

| Path | What it is |
| --- | --- |
| `src/content/products/` | One Markdown file per product (frontmatter + description) |
| `src/content/tutorials/` | One Markdown file per tutorial |
| `src/content/tools/` | One YAML file per tool on the Tools page |
| `src/data/site.json` | Announcement bar, pricing plans, FAQ, Discord and all-access links |
| `src/styles/global.css` | Brand tokens: change `--lime`, `--lilac` and `--ink` here to restyle everything |
| `public/images/` | Uploaded images (Pages CMS puts uploads here) |
| `.pages.yml` | Pages CMS configuration |

### Pages

- `/` homepage, with two ways in: "I design in Affinity" and "I build for the web"
- `/shop/` everything, with live search and a "Works with" filter (`/shop/?q=halftone`, `?tool=framer`)
- Three sections, each with a page per type:
  - `/graphics/`: `effects`, `textures`, `brushes`, `icons`, `mockups`
  - `/templates/`: `social`, `brand`, `print`, `presentations`
  - `/web/`: `webgl`, `framer`, `code`, `sites`
- `/collections/offset/`, `/collections/detach/`, `/collections/glass/` collections
- `/products/<file-name>/` product pages
- `/learn/` with `/learn/tutorials/`, `/learn/cheat-sheets/`, `/learn/tips/` and `/learn/tools/`; lessons at `/learn/<file-name>/`
- `/license/`, `/thanks/`, `404`

### Structure

Sections, types, the "Works with" tools and collections are defined in `src/lib/structure.ts`. A product's **Type** (in Pages CMS) puts it in a section; a type without products shows as **Soon** in the menu until the first one is published. To add a new type, add it to `categories` in `structure.ts` and to the Type options in `.pages.yml`. Old addresses (`/shop/brushes/`, `/tools/`…) redirect via `public/_redirects`.

## Go live

1. **GitHub.** Create a repository and push this folder to it.
2. **Cloudflare Pages.** Workers & Pages → Create → Pages → Connect to Git → pick the repo. Framework preset **Astro**, build command `npm run build`, output folder `dist`. If the build complains about Node, add the environment variable `NODE_VERSION` = `22`. You get a free `*.pages.dev` address to test on first.
3. **Domain.** In the Pages project → Custom domains → add `shapeshifters.supply`. With the domain registered at Cloudflare, the DNS is set up for you.
4. **Pages CMS.** Sign in at pagescms.org with GitHub and open the repo. The editor reads `.pages.yml`, so Products, Tutorials, Tools and Site settings show up straight away. Every save is a commit, and Cloudflare redeploys automatically.

## Web products: live demos and videos

Web products (WebGL effects, Framer components, code) have three extra fields in Pages CMS:

- **Live demo URL**: a page that runs the effect. Adds an "Open live preview" button, and with
  **Show the demo in the gallery** on, the demo runs as the first gallery slide. Use a full URL
  (e.g. `https://fx.shiftedshape.com/embed/retro-screen/`) or a page in this site under
  `public/demos/<name>/index.html` (then the URL is `/demos/<name>/`). Retro Screen, Glass Trail
  and Selection Stage FX live there now: each has the effect's JavaScript next to its page, and
  `embed/` is the bare effect for the gallery slide. An embed on another domain
  must allow `https://shapeshifters.supply` in its `frame-ancestors` header.
- **Demo shape**: the aspect ratio of the demo slide.
- **Cover video**: a short muted loop (MP4/WebM, a few MB) that plays on cards instead of the
  cover image. Keep the cover image too: it is the poster and the share image.

## Selling with Polar

Each product has one or more **licenses** (e.g. Personal and Commercial). For each license:

1. In Polar, create a product with that price and attach the download files as a benefit.
2. Create a checkout link for it.
3. Paste the link into the license's **Polar checkout link** field in Pages CMS.

Until a link is filled in, the buy button reads "Checkout coming soon" and does nothing. Free packs work the same way with a free Polar product, which also collects the buyer's email.

**Checkout overlay.** Buy buttons open Polar's checkout on top of your page instead of a new one. For this to work, add every domain the site runs on in Polar under **Settings → Embedding** (e.g. your `*.pages.dev` test address and `shapeshifters.supply`), or the overlay stays blank. Turn it off under Site settings → "Checkout as overlay" to send buyers to Polar's page instead.

**Sandbox vs live.** Polar's sandbox and production are separate accounts. Test with sandbox links and Stripe's test card `4242 4242 4242 4242`; at launch, recreate the products in production and swap in the live links.

For the all-access pass later: create a subscription product in Polar, paste its checkout link under Site settings → All-access, and switch **Live** on.

## Forms

Both forms are connected in **Site settings → Forms**. While those fields are empty they fall back to Netlify Forms, which only works on Netlify.

- **Newsletter → Kit.** In Kit, create a form (Grow → Landing pages & forms), open it, and copy the number from its embed code (`app.kit.com/forms/1234567/subscriptions` → `1234567`) into **Kit form ID**. In the form's settings, set *After subscribing* to redirect to `https://shapeshifters.supply/thanks/`, and use Kit's incentive email to send the Free Starter Pack.
- **Tool suggestions → Web3Forms.** Get a free access key at web3forms.com for the email address that should receive suggestions, and paste it into **Web3Forms access key**. Visitors land on `/thanks/` after sending.

Response headers (caching, security) live in `public/_headers`, which Cloudflare Pages reads.

## Before launch

Search the project for `[` placeholders and replace them:

- `[YOUR LICENSE TERMS]` in `src/data/site.json` and `src/pages/license.astro`
- `[PRICE]` in the pricing plans (`src/data/site.json`)
- `[WHY YOU USE IT]` for design.dev (`src/content/tools/design-dev.yml`)
- `[FILE TYPES]`, `[SIZE]`, `[VERSION]` in product specs

Also:

- Set `affiliate: true` only on tools where you've joined a real affiliate programme, and paste your affiliate link as the `url`.
- Fill in `discordUrl` and `affinityUrl` in Site settings (the Discord lines and the "Get Affinity" button stay hidden until they're set).
- The sample products, tutorials and counts are placeholders from the design. Replace them with the real packs.

## Fonts

Inter and Space Grotesk are self-hosted through Fontsource, so no requests go to Google (no cookie or GDPR questions about font loading).
