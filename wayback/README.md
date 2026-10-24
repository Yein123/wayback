# Wayback

Snap your parking spot, and Wayback walks you to your room and back to your car, inside a building where GPS can't see.

Wayback is a phone web app. When you park, you snap the four sides around you. An AI model (CLIP) running **inside your phone's browser** compares the photos with reference photos of the building to work out where you are, and a shortest-path route walks you there step by step on a 3D model of the whole building. The demo building is Block M06, Desasiswa Tekun, USM.

**Try it:** https://wayback-m06-1626.web.app (it only gives real results at M06).

## How it works

- **Matching** (`lib/matcher.ts`, `lib/clip.worker.ts`, `lib/scoring.ts`): CLIP turns each photo into 512 numbers and compares them with pre-computed numbers for every reference photo (`public/data/embeddings.json`). The four sides are averaged per spot, so a spot has to match from several directions. You always confirm with ✓.
- **Sign reading** (`lib/readSign.ts`, `lib/ocr.worker.ts`, `lib/signText.ts`): free PaddleOCR runs in the browser beside the photo match and reads the words in each photo. A door plate (F-6-26) puts you at that room, a cube's board (F6-25 - F6-28) at the stair corridor below it, and an ARAS sign tells the floor. The sign wins over the photo match; if it's still wrong you can type your place or retry.
- **GPS pin** (`lib/gps.ts`): when the phone's location is accurate (within ~20 m), spots far from you are ruled out. It never decides the floor, and it's off until GPS anchors are surveyed (`public/data/gps-anchors.json`).
- **Map** (`public/data/dorm-map.json`): spots (car park, entrances, lobbies, hallway stairs, cube, room) and one-way links with walking costs, instructions, and a diagram for each.
- **Route** (`lib/route.ts`): Dijkstra's shortest path over the map, turned into one step per link. After a lift or stairs step, the app asks you to confirm the floor.
- **Building** (`lib/building.ts`, `components/Building3D.tsx`): every floor generated from the building's layout rules and drawn in 3D with three.js: the whole tower, then a dive into your floor, with your route glowing.
- **Parkings** (`lib/parkings.ts`): your current parking and history in Firestore, private to your phone (anonymous sign-in).
- **Survey mode** (`app/survey`, `lib/survey.ts`): pin where you stand on a floor plan, read GPS, and snap four sides; photos upload live to Firestore for importing as reference photos and GPS anchors.

Everything runs free: CLIP in the browser, Firebase on the free plan, no paid AI API.

## Run it locally

Needs Node.js 20.9 or newer and a Firebase web app config.

```bash
cd wayback
npm install
npm run dev
```

Before `npm run dev`, create `wayback/.env.local` with your Firebase web app's config (Firebase console → Project settings → Your apps). These are public web settings, not passwords, but keep the file out of git:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Open http://localhost:3000. On a laptop, use the browser's phone view and pick photos instead of taking them. The first visit downloads the AI model (about 89 MB); after that the browser caches it.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Route, building, scoring and GPS tests (Vitest) |
| `npm run check:ocr` | Reads the real sign photos in `tests/fixtures/signs/` with PaddleOCR (slow, a few minutes) |
| `npm run embeddings` | Re-computes `public/data/embeddings.json` after you change the reference photos |
| `npm run check:match` | Checks that a cropped, darker copy of each reference photo still matches its own spot |
| `npm run import-survey -- pack.json` | Imports a survey pack (from Survey mode) as reference photos and GPS anchors |
| `npm run build` | Static production build into `out/` |

## Surveying the building

1. On Home, open **Survey mode**. A new phone shows its surveyor ID: add it to the list in `firestore.rules` and run `firebase deploy --only firestore:rules`.
2. At each spot: pick the floor, tap where you stand, let GPS read, and snap front, right, back and left.
3. On the laptop (also an approved surveyor), tap **Download import pack**, then `npm run import-survey -- <pack>.json` and `npm run embeddings`.
4. Rebuild and deploy.

## Deploying

Hosted on **Firebase Hosting** (project `wayback-m06-1626`) as a static export:

```bash
npm run build
firebase deploy --only hosting            # add firestore:rules when the rules change
```

The phone camera and GPS need an `https://` link, which Firebase Hosting provides.
