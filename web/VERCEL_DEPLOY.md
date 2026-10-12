# Deploy Signal Scout (Next.js) to Vercel

**Architecture (chosen):** Vercel Services → public service `web` only (`vercel.json` at repo root). The Python scout agent stays on **EC2** (`SCOUT_AGENT_URL`). Neo4j + long scout runs are a poor fit for Vercel Python serverless.

Goal: get a public HTTPS domain so Google OAuth can use:

| Consent field | URL |
| --- | --- |
| Application home page | `https://YOUR_APP.vercel.app/` |
| Privacy policy | `https://YOUR_APP.vercel.app/privacy` |
| Terms of service | `https://YOUR_APP.vercel.app/terms` |
| Redirect URI | `https://YOUR_APP.vercel.app/api/auth/callback/google` |

The Python scout agent stays on **EC2**. Vercel only hosts the `web/` Next.js app.

---

## 0. Prerequisites

- GitHub repo pushed (this repo: `origin` → GitHub)
- Google Cloud project with OAuth client + Gmail API enabled
- EC2 scout agent reachable at `http://YOUR_EC2_IP:8787` (optional for login/privacy pages; required for scout)

---

## 1. Push latest code

From the repo root:

```bash
git add web
git status
git commit -m "Prepare web app for Vercel deploy"
git push origin main
```

---

## 2. Create the Vercel project

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. **Import** your GitHub repo (`karthik1codes/retrench` or fork)
3. Configure:
   - Leave **Root Directory** as repo root (`.`) — `vercel.json` defines service `web` with `"root": "web"`
   - Or, if the UI asks for a single app without services: Root Directory = `web`
4. Do **not** click Deploy yet — add env vars first (next step).  
   Or deploy once, then add env and **Redeploy**.

---

## 3. Environment variables (Vercel)

Project → **Settings → Environment Variables** → add for **Production** (and Preview if you want).

Copy from `web/env.vercel.example`. Required:

| Name | Example / notes |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `AUTH_URL` | `https://YOUR_PROJECT.vercel.app` (set after you know the URL) |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
| `SCOUT_AGENT_URL` | `http://YOUR_EC2_PUBLIC_IP:8787` |
| `SCOUT_API_TOKEN` | Same token as on EC2 (`SCOUT_API_TOKEN`) |
| `SCOUT_FALLBACK_DEMO` | `0` |

Generate a secret locally:

```bash
openssl rand -base64 32
```

**First deploy tip:** If you do not know the Vercel URL yet:

1. Deploy with placeholder `AUTH_URL=https://localhost` (or skip Google vars)
2. Copy the real URL from the deployment (e.g. `https://retrench-xxx.vercel.app`)
3. Set `AUTH_URL` + `NEXT_PUBLIC_APP_URL` to that URL
4. **Redeploy**

---

## 4. Deploy

Click **Deploy**. Wait until status is Ready. Open the URL — you should see the landing page.

Confirm these load without login:

- `https://YOUR_APP.vercel.app/`
- `https://YOUR_APP.vercel.app/privacy`
- `https://YOUR_APP.vercel.app/terms`
- `https://YOUR_APP.vercel.app/settings/google`

---

## 5. Wire Google OAuth to the Vercel domain

### A. OAuth client redirect

[Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials)

Edit your **Web client**:

**Authorized JavaScript origins**

- `https://YOUR_APP.vercel.app`

**Authorized redirect URIs**

- `https://YOUR_APP.vercel.app/api/auth/callback/google`

(Keep `http://localhost:3000` variants if you still develop locally.)

### B. OAuth consent screen

[Consent screen](https://console.cloud.google.com/apis/credentials/consent)

| Field | Value |
| --- | --- |
| App name | Signal Scout |
| App logo | Upload `web/public/brand/signal-scout-oauth-logo.jpg` |
| Application home page | `https://YOUR_APP.vercel.app` |
| Privacy policy | `https://YOUR_APP.vercel.app/privacy` |
| Terms of service | `https://YOUR_APP.vercel.app/terms` |
| Authorized domains | `vercel.app` (Google may auto-add; also add a custom domain if you use one) |
| Test users | Your Gmail + any teammate Gmails |

Save. Stay on **Publishing status = Testing** for private testers.

---

## 6. Sign in smoke test

1. Open `https://YOUR_APP.vercel.app/login`
2. Continue with Google (use a **test user** email)
3. You should land on `/scout`
4. If blocked by “verification / contact developer” → add that email under Test users and retry

---

## 7. EC2 agent (scout features)

Vercel calls your agent **server-side**. Ensure:

1. Security group allows **inbound TCP 8787** (from internet, or at least from anywhere for hackathon)
2. Agent is running: `python -m signalscout serve --host 0.0.0.0 --port 8787`
3. `SCOUT_API_TOKEN` matches Vercel and EC2
4. On EC2 you can set `SCOUT_CORS_ORIGIN=*` (default) — CORS is optional for server-to-server

Test:

```bash
curl -s -H "X-Scout-Token: YOUR_TOKEN" http://YOUR_EC2_IP:8787/health
```

(If there is no `/health`, hit `/targets` or your known status route.)

---

## 8. Optional: custom domain

Vercel → Project → **Settings → Domains** → add `scout.yourdomain.com`.

Then update:

- `AUTH_URL` / `NEXT_PUBLIC_APP_URL`
- Google redirect URI + consent links + authorized domain
- Redeploy

---

## Checklist

- [ ] Repo-root `vercel.json` present (service `web` → `web/`)
- [ ] Env vars set; `AUTH_URL` matches live HTTPS URL
- [ ] `SCOUT_AGENT_URL` points at EC2 `:8787`
- [ ] `/privacy` and `/terms` open publicly
- [ ] Google redirect URI includes `/api/auth/callback/google`
- [ ] Test user added
- [ ] Logo uploaded (red JPG)
- [ ] EC2 security group allows Vercel → TCP 8787

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `redirect_uri_mismatch` | Redirect URI must exactly match `AUTH_URL` + `/api/auth/callback/google` |
| App in testing / contact developer | Add Gmail under Test users |
| Sign-in loops | `AUTH_SECRET` + `AUTH_URL` missing or wrong; Redeploy after fixing |
| Scout fails / 502 | EC2 down, wrong `SCOUT_AGENT_URL`, or port 8787 blocked |
| Privacy URL rejected by Google | Must be public `https://` (Vercel URL works) |
