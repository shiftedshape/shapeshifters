# Shapeshifters · shapeshifters.supply

The store for Affinity templates, brushes, textures and social media packs.
Built with **Astro**, edited in **Pages CMS**, hosted on **Netlify**, checkout through **Polar**.

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

- `/` homepage
- `/shop/` all products with live search (`/shop/?q=halftone` works from the hero search)
- `/shop/templates/`, `/shop/brushes/`, `/shop/social/` categories
- `/collections/offset/`, `/collections/detach/` collections
- `/products/<file-name>/` product pages
- `/tools/` tools and affiliate links
- `/learn/` and `/learn/<file-name>/` tutorials
- `/license/`, `/thanks/`, `404`

## Go live

1. **GitHub.** Create a repository and push this folder to it.
2. **Netlify.** Add new site → import from GitHub → pick the repo. Build settings come from `netlify.toml`.
3. **Domain.** In Netlify, Domain management → add `shapeshifters.supply`, then add the DNS records Netlify shows you at the place you registered the domain (Google Workspace / Squarespace Domains).
4. **Pages CMS.** Sign in at pagescms.org with GitHub and open the repo. The editor reads `.pages.yml`, so Products, Tutorials, Tools and Site settings show up straight away. Every save is a commit, and Netlify redeploys automatically.

## Selling with Polar

Each product has one or more **licenses** (e.g. Personal and Commercial). For each license:

1. In Polar, create a product with that price and attach the download files as a benefit.
2. Create a checkout link for it.
3. Paste the link into the license's **Polar checkout link** field in Pages CMS.

Until a link is filled in, the buy button reads "Checkout coming soon" and does nothing. Free packs work the same way with a free Polar product, which also collects the buyer's email.

**Checkout overlay.** Buy buttons open Polar's checkout on top of your page instead of a new one. For this to work, add every domain the site runs on in Polar under **Settings → Embedding** (e.g. `shapeshifters-supply.netlify.app` and `shapeshifters.supply`), or the overlay stays blank. Turn it off under Site settings → "Checkout as overlay" to send buyers to Polar's page instead.

**Sandbox vs live.** Polar's sandbox and production are separate accounts. Test with sandbox links and Stripe's test card `4242 4242 4242 4242`; at launch, recreate the products in production and swap in the live links.

For the all-access pass later: create a subscription product in Polar, paste its checkout link under Site settings → All-access, and switch **Live** on.

## Forms

The newsletter signup and the "Suggest a tool" form use **Netlify Forms**, so they work on deploy with no setup. Submissions appear in Netlify under Forms. To send signups to a newsletter tool instead, either connect it in Netlify (Forms → notifications / integrations) or change the form `action` in `src/components/JoinBlock.astro` to your newsletter tool's form URL.

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
