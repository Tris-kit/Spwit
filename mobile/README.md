# Tabby

Scan a receipt, tap who had what, and send everyone their share. A local-first
receipt/tab splitter built with Expo + React Native.

## Flow

Start → Build (items + people) → Tax/Tip → Results breakdown. Start also branches
to Profile, Contacts, and History. Bills are stored on-device in AsyncStorage.

## Develop

```bash
npm install
npm run ios      # or: npm run android / npm run web
```

Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/
before changing native/config code.

## Backend

Optional. OCR proxy + shareable bill links live in a separate repo,
[`Tris-kit/Tabby-Backend`](https://github.com/Tris-kit/Tabby-Backend)
(Next.js on Vercel). Point the app at a deployment with:

```
EXPO_PUBLIC_API_BASE=https://your-deployment.vercel.app
```

`src/backend.ts` is the client. When unset, the app falls back to the on-device
OCR path (`src/scan.ts`), so the backend is not required to run the app.
