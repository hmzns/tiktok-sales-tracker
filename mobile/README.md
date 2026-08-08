# TikTok Sales Tracker frontend

Expo 57 / React Native frontend for the TikTok Sales Tracker v1.0.0 web application.

## Development

```bash
npm ci
cp .env.example .env
npm run web
```

For Expo Go on a phone, set `EXPO_PUBLIC_API_URL` to the development computer's LAN address instead of `localhost`, then run `npm start`.

## Public environment variables

- `EXPO_PUBLIC_API_URL`: backend origin, with no trailing path required
- `EXPO_PUBLIC_BACKEND_API_KEY`: value matching backend `APP_API_KEY`

Expo embeds every `EXPO_PUBLIC_*` value in the frontend bundle. Never place TikTok credentials, database credentials, tokens, or encryption keys in this package. The API key is intentionally browser-visible under the existing architecture; Cloudflare Access remains the user-facing production access control.

## Checks and production export

```bash
npx tsc --noEmit
npm test --if-present
npm run lint
npm run web:export
```

Cloudflare Pages should publish the generated `dist` directory. The app's Expo Router configuration uses static web output.

See the root [README](../README.md), [seller guide](../docs/USER_GUIDE.md), and [admin guide](../docs/ADMIN_GUIDE.md) for complete setup and deployment details.
