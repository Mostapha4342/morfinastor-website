# 🛒 Morphina Store

A **production-ready, high-converting digital-license storefront** built with pure **HTML5, CSS3 and modern vanilla JavaScript** — no build step, no frameworks. It sells genuine Windows, Office, Antivirus, AI and Graphics license keys with instant digital delivery.

![Dark mode](https://img.shields.io/badge/theme-dark%20%2B%20light-navy%20%2F%20white-blue)
![Stack](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Interactive 3D background** — a fullscreen Three.js scene (undulating glowing depth-mesh, drifting particles, orbit rings) that sits *behind* every UI element and reacts to the cursor. Written as a fixed, `pointer-events:none` background canvas, with a pure-CSS 3D fallback when the CDN is unavailable.
- **Dark & Light mode engine** — a themed color system (deep electric blue on navy for dark; sky-blue on pure white for light). Toggling re-themes **every** UI element *and* the WebGL scene lighting in real time.
- **Full e-commerce cart** — slide-over drawer with Add / Remove / Update quantity / Clear, **`localStorage` persistence**, and live **Subtotal → Tax → Total** re-pricing.
- **Multi-step checkout** — Customer details → Payment gateway → Order review, with **form validation** (email format, required fields).
- **PayPal Express & Stripe (Elements)** — production-ready frontend integration (SDK lazy-loaded on demand, `onApprove` capture, Stripe token flow).
- **Kinguin auto-delivery readiness** — a structured async `processKinguinOrder()` handshake (availability → purchase → capture key → email) that both gateways call on success, showing the generated key with a **Copy Key** button.
- **Multi-currency pricing** — USD / EUR / GBP / MAD live re-pricing.
- **Category filters, live search, toasts, and a responsive product grid.**

---

## 📁 Project structure

```
morphina-store/
├── index.html          # markup + entry point
├── styles.css          # design system, themes, layout, components
├── app.js              # all logic: state, cart, checkout, gateways, Kinguin
├── server.js           # zero-dependency static dev server (npm start)
├── package.json        # scripts + metadata
├── .env.example        # documented env-variable template
├── .gitignore
├── README.md
└── assets/
    └── img/            # product cover images (13)
```

---

## 🚀 Local installation & setup

Requires **Node.js ≥ 14** (only for the local dev server; the site itself ships no dependencies).

```bash
# 1. Clone / enter the project
cd morphina-store

# 2. Install (no runtime deps — just creates the lockfile)
npm install

# 3. Start the local server
npm start
#   ▶ Morphina Store running at  http://localhost:3000
```

> Prefer no Node? Any static server works — e.g. `python3 -m http.server` in this folder.

---

## 🔐 Environment variables

Copy `.env.example` → `.env` and fill in your values. **Never commit `.env`** (it's git-ignored). Everything is documented in `.env.example`:

| Variable | Purpose |
|----------|---------|
| `PORT` | Local dev server port (default `3000`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | Transactional email used to deliver & auto-confirm license keys |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal REST app credentials (server-side) |
| `STRIPE_KEY` | Stripe **secret** key (server-side; never expose) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe **publishable** key (safe to expose in `app.js`) |
| `KINGUIN_API_KEY` / `KINGUIN_API_SECRET` | Kinguin auto-delivery server-side keys |
| `STORE_CURRENCY` | Base settlement currency (default `USD`) |
| `TAX_RATE` | Sales/VAT rate applied at checkout (e.g. `0.0825`; default `0`) |

> **Client-side keys live in `app.js`** (the `PAYPAL` and `STRIPE` config objects). Paste your **PayPal Client ID** and **Stripe Publishable Key** there. The **secret** keys stay in `.env` / your backend proxy and are **never** shipped to the browser.

---

## ☁️ One-click deployment

No build step — the files are static, so deploy is instant on all of these.

### Netlify
1. Push the repo to GitHub (see [Git workflow](#--git-workflow)).
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. **Build command:** leave empty. **Publish directory:** `/` (or leave as `dist`-free root).
4. Add your custom domain: Site settings → **Domain management** → `yourdomain.com` and `www`.
5. Add the DNS records (see below) and **Enable HTTPS** (auto Let's Encrypt).

### Vercel
1. Push to GitHub → **Vercel → New Project → Import**.
2. Framework preset: **Other**. **Build command:** empty. **Output directory:** `/`.
3. Add environment variables (`STRIPE_KEY`, `PAYPAL_CLIENT_ID`, `SMTP_*`, `KINGUIN_*`) in **Settings → Environment Variables**.
4. **Settings → Domains** → add `yourdomain.com` + `www`, then update DNS.

### GitHub Pages
1. Push the `morphina-store/` contents to the repo root.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)`.
3. For a custom domain: create a **`CNAME`** file at the repo root containing only `yourdomain.com`, add the DNS records below, then **Enforce HTTPS**.

### DNS records (custom domain)

| Host | Type | Value |
|------|------|-------|
| Netlify | A | `75.2.60.5` |
| Netlify `www` | CNAME | `your-site.netlify.app` |
| Vercel | A | `76.76.21.21` |
| Vercel `www` | CNAME | `cname.vercel-dns.com` |
| GitHub Pages | A | `185.199.108.153` |
| GitHub Pages `www` | CNAME | `yourusername.github.io` |

---

## 🔌 Configuring payments & Kinguin delivery

1. **PayPal** — create a REST app in the [PayPal Developer Dashboard](https://developer.paypal.com) and paste the **Client ID** into `app.js` → `PAYPAL.clientId`. The Smart Buttons load from the SDK lazily on the review step; `onApprove` captures the order and calls Kinguin fulfillment.
2. **Stripe** — grab your **Publishable Key** from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys) and set it in `app.js` → `STRIPE.publishableKey`. The Card Element mounts on the payment step; `submitOrder` tokenizes the card and calls Kinguin fulfillment.
3. **Kinguin** — `processKinguinOrder()` in `app.js` is the structured, commented handshake. For production, proxy the call through your backend (holding `KINGUIN_API_KEY` + secret) and POST the order/keys; a static host cannot hold secrets.

---

## 🧪 Testing the flow

1. Add a product to the cart → open the drawer.
2. **Checkout** → enter a valid email + name.
3. Pick **Credit Card (Stripe)** or **PayPal**, then review the order.
4. Complete payment → the **Order Success** modal shows the generated key with **Copy Key** and an email-confirmation note, and the cart clears.

*(Until real keys are added, the gateways degrade gracefully with an on-screen note; the Kinguin flow uses a mock key generator.)*

---

## 🛠 Troubleshooting

- **Missing images** → ensure `assets/img/` (13 files) is uploaded alongside `index.html`.
- **3D background absent** → the Three.js CDN needs internet; otherwise the CSS 3D fallback shows (which is intentional).
- **Payments not loading** → add your PayPal Client ID / Stripe Publishable Key in `app.js`.
- **SSL not active** → DNS may still be propagating; re-check the platform's domain panel.

---

## 📄 License

Released under the **MIT License**. See `LICENSE` for details.
