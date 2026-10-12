# Google OAuth / Gmail verification setup

Signal Scout requests **Gmail** scopes (`gmail.readonly`, `gmail.send`). Until Google verifies the app for production, the consent screen stays in **Testing** and only **Test users** can sign in. That is the “has not completed the Google verification process” message.

**Need a public domain for Privacy / Terms?** Deploy the Next app to Vercel first — see [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md).

## Quick fix (testers)

1. Open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Under **Audience → Test users**, add the exact Gmail addresses that need access.
3. Wait ~1 minute, sign out of Signal Scout, sign in again.

In-app wizard (logo download + copyable URLs): **`/settings/google`**

## App logo (red)

Upload this file on the consent screen:

- `web/public/brand/signal-scout-oauth-logo.jpg` — red Squircle + white dish (also `/brand/signal-scout-oauth-logo.jpg`)
- SVG mark: `web/public/brand/signal-scout-mark.svg`

## Consent screen fields

| Field | Value |
| --- | --- |
| App name | Signal Scout |
| User support email | Your Google Cloud account email |
| App logo | Upload the JPG above |
| Application home page | `{AUTH_URL}/` |
| Privacy policy | `{AUTH_URL}/privacy` |
| Terms of service | `{AUTH_URL}/terms` |
| Authorized domains | Your production host (e.g. `example.com`) |

## Credentials

1. Enable [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com).
2. Create **OAuth client ID** → Web application.
3. Authorized redirect URI: `{AUTH_URL}/api/auth/callback/google`
4. Put Client ID / Secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Production verification (later)

Publishing with Gmail restricted scopes usually needs Google’s app verification (and often a security assessment). For private / hackathon use, keep **Publishing status = Testing** and maintain the tester list.
