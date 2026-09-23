# Morphina Store — Deploy & Custom Domain Guide

This guide gets **Morphina Store** live on your custom domain with **free SSL (HTTPS)**.
The project is pure static HTML/CSS/JS — **no build step, no backend, no package manager** — so
any static host works.

---

## 1. What to upload

The `deploy/` folder is **ready to deploy**. It contains:

```
deploy/
├── index.html      ← the store (renamed so https://yourdomain.com/ loads it)
└── img/            ← 13 product cover images (referenced with relative paths)
```

- ✅ All asset paths are **relative** (`img/win11.jpg`) → they resolve correctly at the
  domain root **and** on a subpath (e.g. GitHub Pages `https://user.github.io/morphina/`).
- ✅ The page is a **single-file entry** (`index.html` = the whole store, including the
  3D background, cart, checkout, PayPal/Stripe, and Kinguin logic).

> The other files in your workspace (`morphina-store.html`, the old `index.html`) are
> working copies / prototypes. **Upload only the contents of `deploy/`.** If you later edit
> `morphina-store.html`, re-copy it into `deploy/index.html`.

---

## 2. Exact DNS Records

Where to add them: your **domain registrar** (Namecheap, GoDaddy, Google Domains, Cloudflare,
etc.). Pick **one** host below and use only that host's records.

| Host | Record type | Host/name | Value | Purpose |
|------|-------------|-----------|-------|---------|
| **Netlify** | `A` | `@` (or empty) | `75.2.60.5` | apex → your site |
| **Netlify** | `CNAME` | `www` | `your-site.netlify.app` | www → your site |
| **Vercel** | `A` | `@` (or empty) | `76.76.21.21` | apex → your site |
| **Vercel** | `CNAME` | `www` | `cname.vercel-dns.com` | www → your site |
| **GitHub Pages** | `A` | `@` (or empty) | `185.199.108.153` | apex → GitHub Pages |
| **GitHub Pages** | `A` | `@` (or empty) | `185.199.109.153` | alternate |
| **GitHub Pages** | `A` | `@` (or empty) | `185.199.110.153` | alternate |
| **GitHub Pages** | `A` | `@` (or empty) | `185.199.111.153` | alternate |
| **GitHub Pages** | `CNAME` | `www` | `yourusername.github.io` | www → your site |

Notes:
- `@` (or empty host) is the **root/apex** domain (`example.com`). `www` is the subdomain.
- **Delete any old A / CNAME / AAAA records** you're not using to avoid conflicts.
- **Do not add a `CNAME` for `@`** — DNS forbids a CNAME at the root. Use the `A` record there.
- It can take **5–60 minutes** (up to a few hours) for DNS to propagate.

---

## 3. Deploy — pick one platform

### Option A — Netlify (easiest, free SSL, drag & drop)
1. Go to **app.netlify.com → Add new site → Deploy manually**.
2. **Drag the `deploy/` folder** (its contents) into the drop zone. Done — a
   `https://<random>.netlify.app` URL appears.
3. **Custom domain:** Site settings → **Domain management** → **Add custom domain** →
   enter `yourdomain.com` and `www.yourdomain.com`.
4. Add the **A + CNAME** records from the table above.
5. Netlify auto-issues a **free Let's Encrypt SSL certificate** (usually within minutes).
   Toggle **"Force HTTPS"** in settings.
6. Optional: go to **Deploys** and set it up so a Git repo push auto-redeploys.

### Option B — Vercel (free SSL, great for git)
1. Go to **vercel.com → Import Project**.
2. Push the `deploy/` folder to a GitHub/GitLab repo, or use **Add New → Project** and
   upload the folder manually (Vercel auto-detects "Other" / static, no build command needed).
3. Vercel gives a `https://<project>.vercel.app` preview. **Framework preset:** Other.
   **Build command:** leave empty. **Output directory:** the folder root.
4. **Custom domain:** Project → **Settings → Domains** → add `yourdomain.com` and `www`.
5. Add the **A + CNAME** records above. Vercel provision a **free SSL** cert automatically
   and warns you via email when it's live.
6. Wait for DNS to propagate, then confirm in Vercel's domains panel.

### Option C — GitHub Pages (free, git-based)
1. Create a repo, upload the **contents of `deploy/`**.
2. Repo → **Settings → Pages** → Source **Deploy from a branch** → branch `main`, folder `/ (root)`.
3. It publishes at `https://<yourusername>.github.io/<repo>/` (note the subpath — relative
   paths keep it working).
4. **Custom domain:** add the A records (and the `www` CNAME) above. Also create a file
   named **`CNAME`** (no extension) in the repo root containing only `yourdomain.com`.
5. GitHub automatically requests a **free SSL certificate** for your custom domain.
6. Under **Settings → Pages → Custom domain** do **"Enforce HTTPS"** once the cert is issued.

---

## 4. Before you go live — final checklist

1. **Fill in your keys** (in `deploy/index.html`, at the `PAYPAL` / `STRIPE` config blocks):
   - `PAYPAL.clientId` → paste your **PayPal Client ID**.
   - `STRIPE.publishableKey` → paste your **Stripe publishable key** (`pk_…`).
   - `KINGUIN.apiKey` → **keep server-side only**; wire the auto-delivery to a backend proxy.
2. **Check the currency** matches your PayPal settlement currency (`PAYPAL.currency = "USD"`).
3. **Test the cart → checkout → PayPal/Stripe → key delivery** flow on the live HTTPS URL.
4. Set up DNS, then confirm `https://yourdomain.com` loads (the page also serves as `index.html`
   so visiting the root works).
5. **Serve over HTTPS** — the cart uses `localStorage`; any browser localStorage is per-domain,
   so data persists as long as the user stays on `yourdomain.com` (it won't carry across
   `developer`/`www` variants — choose one canonical host).
6. Update the footer copyright year (auto-filled) and any legal links (Terms / Privacy policy).

---

## 5. Troubleshooting

- **Page loads but images are missing** → the `img/` folder wasn't uploaded alongside
  `index.html`. Make sure the relative `img/…` files are present (13 covers).
- **SSL not active yet** → wait up to a few minutes (GitHub Pages can take a few hours).
- **Apex (`@`) won't validate** → confirm you used an **A record at the root** and
  your registrar isn't blocking root `A` records (some require a dummy `CNAME` + `A` combo for
  the `www` first).
- **`www` vs non-`www`** → pick one canonical version, add its record, and set up a redirect
  (Netlify/Vercel do this automatically for the alternate form).

---

## 6. Production notes (why this is ready)

- **No build step** → deploy time is minutes; the single-file store ships the 3D background,
  cart, multi-step checkout, PayPal/Stripe, and Kinguin fulfillment in one request.
- **Graceful degradation** → if the 3D CDN (Three.js) or a payment SDK can't load, the UI
  shows a CSS fallback and an on-screen note instead of breaking.
- **Client-side cart** uses `localStorage`; for cross-device carts, wire the order snapshot
  to your backend alongside the Kinguin call.
