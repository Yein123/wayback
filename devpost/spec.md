---
doc: spec
status: approved
---

# Wayback — Technical Spec

Implements `prd.md` (approved). Stays inside `scope.md > The POC Boundary`.

## How This Works, In Plain Language

Wayback is a **Next.js web app you open in your phone's browser** at an `https://` link hosted free on **Firebase Hosting** (changed from Vercel during the build). There's no app store.

The app has four kinds of pieces:

1. **The dorm map file.** This is a hand-written JSON file listing every spot on the demo path (car park zones, entrances, lift lobbies, corridors, rooms) and which spots connect to which. It never changes while the app runs.
2. **The reference photos.** These are ~10–20 photos you take once, each tagged with the map spot it shows. Before the app runs, a small script feeds every photo through an AI model called **CLIP**, which turns each photo into a list of numbers (an *embedding*) describing what it looks like. Those numbers are saved to a file.
3. **The AI in the browser.** When you snap a photo, the same CLIP model runs *inside your phone's browser* (via Transformers.js) and turns your photo into numbers too. The app compares them against every reference photo, and the closest ones become the guesses. This is the **retrieval** part of RAG: find the most similar stored items. A second small model (Tesseract.js) reads any sign text in the photo, like "B1", and a match on that text boosts the right guess.
4. **Firebase Firestore.** This cloud database stores *your* Current Parking and Parking History, with a small thumbnail of each photo. An invisible anonymous sign-in gives this phone its own private records, so there's no login screen.

The **route** is plain code, not AI. The **Dijkstra** shortest-path algorithm walks the map's connections from where you are to where you're going, and each link it picks becomes one direction step with a simple glowing diagram.

**Why this shape:** everything AI runs free in the browser (no paid API, per "free for now"), the only cloud service is Firebase, which you already know, and the fixed building data is just files in the project.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Open the app** → Next.js loads the Home page → the [Parking Store](#parking-store-firebase) signs in anonymously and reads your `current` parking and history from Firestore → Home shows them. In the background, the [Location Matcher](#location-matcher) starts downloading CLIP so it's ready.
2. **Tap Capture** → the phone camera opens (a file input with `capture`) → you take a photo → GPS is requested once (it may fail, and that's fine).
3. **Matching** → the Location Matcher shrinks the photo, runs CLIP → compares against `embeddings.json` → runs OCR → combines the scores → returns the ranked spots → the Location Result screen shows the top one ("B1 · Zone C" + its reference photo).
4. **✓ Confirm** → the Parking Store writes a `current` parking (spot ID, label, thumbnail, GPS, time) to Firestore. If it's wrong: Other Guesses → sign photo → list picker (see [Locate Flow](#locate-flow)).
5. **"Where are you going?"** → you type `512` → the [Route Planner](#route-planner) looks up which map spot is room 512 → Dijkstra finds the shortest path from the parking spot → the path becomes a list of steps.
6. **Directions** → the [Step Diagram](#step-diagram) draws each step (three lifts, Lift 2 glowing) → Next / Help.
7. **Find my car** → the same Locate Flow, now locating *you* → the Route Planner goes from your spot to the parking spot → the Directions.
8. **Arrived** → the Parking Store flips the record from `current` to `history`, with an end time → Home shows an empty card, and the trip appears in the history.

```
Phone browser (Next.js app on Firebase Hosting)
┌─────────────────────────────────────────────────────────────┐
│ Screens: Home · Locate · Destination · Directions           │
│     │                │                    │                 │
│     ▼                ▼                    ▼                 │
│ Parking Store   Location Matcher      Route Planner         │
│     │           CLIP + OCR (in browser)  Dijkstra           │
│     │                │                    │                 │
└─────┼────────────────┼────────────────────┼─────────────────┘
      ▼                ▼                    ▼
  Firestore      embeddings.json       dorm-map.json
  (your parkings) + reference photos   (spots + links)
```

## Stack

| Piece | Choice | Why |
|---|---|---|
| App framework | **Next.js** (App Router) + **React** + **TypeScript** | Learner's familiar stack. All screens are client components. |
| Styling | **Tailwind CSS** | Learner's familiar tool. Glow effects via custom shadows. |
| Database | **Firebase Firestore** + **Firebase Anonymous Auth** (JS SDK, Spark free plan) | Learner's choice, preferred over browser storage. No Cloud Storage (it needs the Blaze plan). |
| Image AI | **Transformers.js v4** (`@huggingface/transformers`) with the CLIP model `Xenova/clip-vit-base-patch32` (quantized vision model, ~89 MB, run on WASM in a Web Worker) | Free, runs in the browser, and produces the same numbers in Node for the setup script. |
| Sign reading | **Tesseract.js** | Free in-browser OCR. |
| Route | Hand-written Dijkstra in TypeScript | Small map. No library needed. |
| 3D building view | **three.js** + **@react-three/fiber** (no drei) | Learner asked for a game-like, immersive view of the whole building that dives into the route; CSS can't give real depth, walls, lighting or a free camera. Kept to plain shapes, no textures, so it stays light next to CLIP on the phone. |
| Hosting | **Firebase Hosting** (Spark, free), static export (`output: "export"` → `out/`) | A real `https://` link the phone can open in the car park. Chosen during the build over Vercel: the learner was already signed in to Firebase, it's one command, and data, survey uploads and hosting share one project. Tradeoff: no Next.js server features (none are used). |
| Tests | **Vitest** for the route planner and score-combining logic only | These are pure functions and easy to check. |

Docs:
- [Next.js](https://nextjs.org/docs)
- [Tailwind](https://tailwindcss.com/docs)
- [Firestore web](https://firebase.google.com/docs/firestore/quickstart)
- [Anonymous Auth](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firestore offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Storage plan change FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Transformers.js](https://huggingface.co/docs/transformers.js) / [v3 blog](https://huggingface.co/blog/transformersjs-v3)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) / [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Vitest](https://vitest.dev)
- [three.js](https://threejs.org/docs) / [react-three-fiber](https://r3f.docs.pmnd.rs)

**Verify early in the build (not yet checked):**
- the current stable versions of Next.js, the Firebase SDK, Transformers.js and Tesseract.js
- the exact CLIP model ID and its download size; the quantized version should be well under ~100 MB
- that the image feature-extraction call works in phone Chrome/Safari, with WASM as the fallback if WebGPU is missing

## Where It Runs and How Someone Tries It

- **Development:** `cd wayback` → `npm install` → create `.env.local` with the Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) → `npm run dev` → open `http://localhost:3000` (on a laptop, use the browser's phone view).
- **Setup step (once, and again whenever the reference photos change):** `npm run embeddings` runs `scripts/build-embeddings.mjs`, which writes `public/data/embeddings.json`.
- **On the phone:** `npm run build` then `firebase deploy --only hosting` (the build reads `.env.local`) → open https://wayback-m06-1626.web.app on the phone (the camera and GPS need https). Optional: "Add to Home Screen".
- **Firebase setup:** create a project (Spark plan), enable Firestore and Anonymous sign-in, add the web app, and deploy `firestore.rules`.
- **Demo recording:** a screen recording on the phone at the dorm, following `scope.md > What "Working" Looks Like`:
  1. capture the parking
  2. confirm
  3. type the room number
  4. follow the steps
  5. later, tap Find my car
  6. snap
  7. follow the steps back
  8. tap Arrived

  Filming the surroundings with a second phone is optional.
- **Submission:** a public GitHub repo and a short demo video (both required). The hosted link is an optional extra for anyone who wants to try it. It only gives correct results at the dorm.

## Look and Feel
From `prd.md > Look and Feel`: a futuristic AR/game HUD, inspired by AR games like Pokémon GO, on a dark background.

- **Palette (proposed, since the PRD left colours open):**
  - background near-black navy `#070B12`, panels `#0E1624` with 1px `#1E2D42` borders
  - **primary glow cyan `#3EE6F2`** for highlights, the active choice and the main buttons
  - secondary violet `#9B7BFF` for accents and history
  - amber `#FFC15E` for "not sure / fix it" states
  - text `#E6F1F5`, muted `#8FA1AD`
- **Glow:** Tailwind custom `boxShadow` like `0 0 16px rgba(62,230,242,.45)`. Highlighted diagram parts use an SVG `filter` blur glow and a slow pulse.
- **Type:** **Orbitron** for headings, labels like "B1 · ZONE C" and step numbers. **Inter** for body text. Both load via `next/font/google`.
- **Shape and energy:** rounded panels (16px), a HUD-style corner bracket on cards, a big round Capture button, and short "quest-like" copy ("Spot locked.", "Next waypoint").
- **Diagrams:** flat 2D SVG with a slight tilt, thin glowing lines on dark, game-like.
- **Building view:** the whole block in real 3D (three.js) in the same palette: dark translucent floors, glowing cyan route, violet for the part already walked, fog for depth. It opens on the whole tower, then dives into your floor and follows you.
- **Avoid:** white backgrounds and generic card-grid dashboards.

## Components

### Screens

#### Home Screen (`app/page.tsx`)
- A big **Capture** button.
- The **Current Parking card**, showing the label, thumbnail, time and **Find my car**. When there's no current parking it shows the empty prompt "Tap Capture when you park".
- The **Parking History** list, newest first, with date, time, label and thumbnail. Rows are view-only.
- Starts the background CLIP load.

PRD ref: `prd.md > Screens and Layout`, `prd.md > Arriving and Parking History`, `prd.md > States and Boundaries` (first use).

#### Locate Flow (`app/locate/page.tsx`, query `?mode=park|car|help`)
One screen that switches between steps.
1. **Snap:** a camera input.
2. **Working:** "Scanning…", with model download progress on first use.
3. **Location Result:** your photo, the top label with its matched reference photo, then ✓ and "No, that's wrong".
4. **Other Guesses:** the ranked guesses 2–4 as tappable labelled reference photos, plus "None of these".
5. **Sign Photo:** "Snap a nearby sign" → OCR-weighted matching → the result again.
6. **List Picker:** every spot grouped by floor, as a last resort.

On confirm:
- `park` → save the parking, then go to Destination.
- `car` / `help` → set "you are here", then go to Directions toward the trip's destination (the car for `car`, the current destination for `help`).

PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Fixing a Wrong Location`, `prd.md > Finding the Car`, `prd.md > Help While Walking`.

#### Destination Screen (`app/destination/page.tsx`)
- "Where are you going?" with a room number input.
- Unknown room → the inline message "Wayback doesn't know room ___ yet", then ask again.

PRD ref: `prd.md > Guiding to a Room`, `prd.md > States and Boundaries`.

#### Directions Screen (`app/directions/page.tsx`)
- A large immersive **building view** on top: 3D (whole tower → dive into your floor → camera follows the route) with a 2D toggle showing the full plan of the current floor. Steps without map positions fall back to the Step Diagram.
- One step at a time below it: one instruction line, the step's reference photo, "Step 2 / 6", **Next**, **Play** and **Help**.
- The last step shows **Arrived**. For a room trip it shows **Done** and goes Home. For a car trip, Arrived ends the parking.

PRD ref: `prd.md > Guiding to a Room`, `prd.md > Finding the Car`, `prd.md > Help While Walking`.

### Location Matcher
`lib/matcher.ts`. Loads CLIP once (cached by the browser after the first download) and loads `embeddings.json`. Given a photo:
1. Resize it to 224px and get its CLIP embedding.
2. Compute the **cosine similarity** (how closely two lists of numbers point the same way) with every reference embedding.
3. Each spot's image score is the best score among its photos.
4. Run OCR. If any recognised word matches a spot's `signText` (case-insensitive), add a **sign bonus** (start at +0.10 and tune it during the build).
5. Return the spots sorted by combined score.

The user always confirms. No confidence threshold is needed, because even the top guess goes through ✓.

**Four-side capture (added during the build):** a capture can hold up to four photos (front, right, back, left). Steps 1–4 run for each photo; a spot's combined score is the average of its per-photo scores, so it must match from several directions. If a GPS fix with accuracy ≤ 20 m is available and the GPS anchors are set, spots more than about (accuracy + 15 m) from the fix are dropped before ranking. Floors are never decided by GPS.

PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Fixing a Wrong Location`.

### Route Planner
`lib/route.ts`, a set of plain functions with Vitest tests.
- `findRoom(roomNumber)` → spot ID or null.
- `shortestPath(fromId, toId)` → Dijkstra over the map's links, weighted by `cost` (rough walking seconds).
- `toSteps(path)` → for each link, a step: `{ text, diagram }` taken from the link's `instruction` and `diagram` fields in the map.

Links are stored one-way with a matching reverse link, so "turn left" going one way is "turn right" coming back.

PRD ref: `prd.md > Guiding to a Room`, `prd.md > Finding the Car`.

### Step Diagram
`components/StepDiagram.tsx`. An SVG drawn from a small set of templates, chosen by `diagram.kind`:
- `lifts`: N lift doors with the `highlight` index glowing
- `turn`: a junction with a left/right/straight arrow
- `lift-ride`: a floor indicator going up or down to the target floor
- `door`: an entrance or exit doorway glowing
- `walk`: a straight corridor arrow
- `stairs`: a staircase going up or down N floors (needed because the M06 lifts skip even floors)
- `half-stairs`: half a flight up or down from a hallway into a cube (M06 split-level)
- `cube`: a T-shaped cube corridor with the target room (1–4) glowing
- `arrive`: a destination marker (a car icon or a room number)

All templates are pure SVG plus Tailwind. No images needed.

PRD ref: `prd.md > Guiding to a Room` ("3 lifts, Lift 2 glowing").

### Parking Store (Firebase)
`lib/firebase.ts` sets up Firebase, anonymous sign-in, and Firestore with offline persistence. `lib/parkings.ts` provides:
- `getCurrent()`
- `listHistory()`
- `saveParking({spotId, label, thumb, gps})`. This also moves any existing `current` parking to `history` (see Decisions).
- `endParking(id)`

Thumbnails are JPEG, about 320px on the long side at quality 0.6 (~20–40 KB), stored as a base64 string inside the record. Firestore's limit is 1 MB per record.

PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Arriving and Parking History`.

### GPS Stamp
`lib/gps.ts`. A single `getCurrentPosition` with a 5-second timeout. It returns `{lat, lng, accuracy}` or `null`. It's saved with the parking and (changed during the build) used as a **pin** by the Location Matcher when accurate. Converting lat/lng to map metres uses `public/data/gps-anchors.json`: two or more real GPS readings taken at known spots (e.g. the SE entrance and the SE car park) during the phone test. Until anchors exist, the pin is off.

PRD ref: `prd.md > Capturing the Parking Spot` (GPS supporting only).

### Trip State
`lib/trip.ts`. A small store read with `useTrip()` (no provider needed) holding the current trip:
- `mode`: `toRoom` or `toCar`
- `from`
- `to`
- `steps`
- `stepIndex`

It is mirrored to `sessionStorage`, so a refresh mid-route keeps your place. It doesn't need to outlive the browser tab.

### Embeddings Setup Script
`scripts/build-embeddings.mjs`. Runs in Node with the same Transformers.js CLIP model. It reads `public/data/reference-photos.json` (file → spot ID), embeds each photo in `public/reference/`, and writes `public/data/embeddings.json`. It never runs in the app.

## Data Model

### Dorm map: `public/data/dorm-map.json`
Hand-written, fixed, and shipped with the app.

```json
{
  "spots": [
    { "id": "cp-zone-c", "label": "Car Park · Zone C", "floor": "G", "type": "parking", "signText": ["C"] },
    { "id": "lobby-l2-g", "label": "Lift 2 Lobby · G", "floor": "G", "type": "lobby", "signText": ["LIFT 2"] },
    { "id": "room-512", "label": "Room 512", "floor": "5", "type": "room", "room": "512" }
  ],
  "links": [
    { "from": "cp-zone-c", "to": "entrance-a", "cost": 40,
      "instruction": "Walk to Entrance A", "diagram": { "kind": "door" } },
    { "from": "lobby-g", "to": "lobby-l2-g", "cost": 5,
      "instruction": "Take Lift 2", "diagram": { "kind": "lifts", "count": 3, "highlight": 1 } }
  ]
}
```

### Demo building: USM Desasiswa Tekun, Block M06
Facts the learner provided (an online search found no public layout):
- **4 directions** (wings), each with **4 entrances**, as the learner described them. The exact layout is still pending.
- **The lifts stop only at B2, 1, 3, 5, 7, 9.** Even floors can only be reached by stairs from a lift floor, so the map needs `stairs` links and a matching step diagram (e.g. "Take the stairs up one floor").
- **Floor plan (learner-provided description):**
  - **Lift lobby** in the centre with **4 lifts**, arranged as two pairs facing each other.
  - **4 hallways** run diagonally out from the lobby corners in an **X**. Each hallway ends in a staircase.
  - Each hallway is a **split-level spine**, halfway between two levels, with **cubes** (blocks of rooms) on both sides.
  - Going outward from the lifts, each side has, in order: **lower cube** (½ flight down), **upper cube** (½ flight up), **upper cube** (½ up), **lower cube** (½ down). The upper cubes sit further back from the hallway.
  - That's 4 cubes per side, 8 per hallway, and **32 per floor**.
  - **Each cube is a dead end.** Its stairs lead only into that cube, so to reach another cube you go back to the hallway.
- **Cube layout:**
  - Each cube has **2 floors**, and a **T-shaped corridor** on each floor connects all 4 rooms. That's 8 rooms per cube.
  - **1st floor:** you enter from the hallway through a gap between the toilet (top left) and the stairs (top right). Rooms **4 and 1** are at the two ends, and **3 and 2** sit side by side along the bottom.
  - **2nd floor:** the rooms are in the same positions. The stairs and toilet swap: the stairs arrive at the top left and the toilet is at the top right.
- **Map implications:**
  - Map spots for this building are: lift lobby, hallway segment, cube entrance (half-flight up or down), cube floor, and room.
  - The step diagrams need a `half-stairs` (½ flight up/down into a cube) and a `cube` view (T-corridor with the target room glowing).
  - Many spots look alike (identical hallways and cubes), so **sign text such as cube or room numbers matters a lot**, and each hallway needs its own reference photos.
- **For the demo map, keep only the demo path** (car park → entrance → lobby → lift → one hallway → one cube → the room), plus enough alternatives that "shortest" is meaningful. Don't map all 32 cubes.
- **Demo room: `F6-26`** (learner): **F = female**, **6 = floor 6**, **26 = room number**. Floor 6 has no lift stop, so the route will use the lift to 5 or 7, then stairs or half-stairs. The room input should accept codes like `F6-26`.
- **Car park:** there are car park levels at **both B2 and floor 1** (learner).
- **Entrances:** there are **3 entrances from the car park** (learner). Choosing the right one is a real "shortest route" decision for the demo.
- **Car park → entrances** (learner): the car park connects to the **SE entrance (floor 1)**, the **SW entrance (B2)** and the **NW entrance (B2)**. NE has no car park entrance.
- **Hallway names are compass directions:** NW, NE, SE, SW.
- **Room numbering per hallway** (F5 rooms are in the lower cubes, F6 rooms in the upper cubes):

  | Hallway | F5 rooms | F6 rooms |
  |---|---|---|
  | NW | F5-01 – 08 | F6-01 – 08 |
  | NE | F5-09 – 24 | F6-09 – 24 |
  | SE | F5-25 – 40 | F6-25 – 40 |
  | SW | F5-41 – 48 | F6-41 – 48 |

- **SE hallway, from the lifts outward** (learner):

  | Stair | Direction | Left side | Right side |
  |---|---|---|---|
  | 1st | down ½ | F5-25 – 28 | F5-37 – 40 |
  | 2nd | up ½ | **F6-25 – 28** ← demo room F6-26 | F6-37 – 40 |
  | 3rd | up ½ | F6-29 – 32 | F6-33 – 36 |
  | 4th | down ½ | F5-29 – 32 | F5-33 – 36 |

  This matches the floor-plan order (lower, upper, upper, lower).
- **Demo path (confirmed by the learner):** car park → **SE entrance (floor 1)** → lift lobby → **lift to 5** → walk to the **SE hallway** → **2nd stair, ½ flight up, left side** → room **F6-26**.
- **Still pending, to collect during `5-build`:**
  - the reference photos

- **Reference photo inventory** (in `reference-inbox/`; the build moves them into `public/reference/` and tags them):

  | File | Shows | Spot | Sign text |
  |---|---|---|---|
  | `photo_2026-10-23_18-18-19.jpg` | Building exterior and car park, from the **SW** side | car park near the SW entrance (B2) | "MO6", "D.TEKUN" |
  | `photo_2026-10-23_18-18-21.jpg` | Floor 5 lobby sign, seen on stepping out of the lift. **Turn right for SE** (F6/F5-25–40 →, F6/F5-09–24 ←) | floor 5 lobby, SE/NE side | "ARAS 5 & 6", "F6-25 - F6-40", "F6-09 - F6-24" |
  | `photo_2026-10-23_18-18-24.jpg` | Floor 5 lobby sign (F6/F5-01–08 →, F6/F5-41–48 ←), KELUAR exit, stairs | floor 5 lobby, NW/SW side | "ARAS 5 & 6", "F6-01 - F6-08", "F6-41 - F6-48", "KELUAR" |
  | `photo_2026-10-23_18-18-28.jpg` | SE hallway, 1st stair (down) | SE stair 1 | "F5-25 - F5-28", "F5-37 - F5-40" |
  | `photo_2026-10-23_18-18-34.jpg` | SE hallway, 2nd stair (up), bridge walkway. **The demo cube.** | SE stair 2 | "F6-25 - F6-28", "F6-37 - F6-40" |
  | `photo_2026-10-23_18-18-36.jpg` | SE hallway, 3rd stair (up) | SE stair 3 | "F6-29 - F6-32", "F6-33 - F6-36" |
  | `photo_2026-10-23_18-18-39.jpg` | SE hallway, 4th stair (down), end staircase with windows | SE stair 4 | "F5-29 - F5-32", "F5-33 - F5-36" |

  | `photo_2026-10-23_18-32-07.jpg` | Looking out of the SE exit to the food court, with the "Dataran Usahawan USM" sign | SE entrance, floor 1 (outward view) | "Dataran Usahawan USM" |
  | `photo_2026-10-23_18-32-04.jpg` | Inside the SE exit, with stairs on the right and the food court through the gap | SE entrance, floor 1 (inside view) | — |
  | `photo_2026-10-23_18-32-02.jpg` | Floor 1 hallway from the SE entrance toward the lift lobby, with stairs ahead and KELUAR | floor 1 hallway, SE entrance → lobby | "F2-37 - F2-40", "F2-41", "KELUAR" |
  | `photo_2026-10-23_18-31-54.jpg` | **Floor 5** lift lobby with 2 lifts visible and stairs on the left (slightly blurry) | floor 5 lift lobby | — |
  | `photo_2026-10-23_18-31-59.jpg` | Inside the lift: buttons 9, 7, 5, 3, 1, B2 | in the lift. **Use it as an illustration for the "lift to 5" step, not as a match target.** | "9 7 5 3 1 B2" |
  | `photo_2026-10-23_18-31-52.jpg` | Half-flight up into the cube, with a shoe rack and a door at the top | SE stair 2 → demo cube entrance | — |
  | `photo_2026-10-23_18-31-42.jpg` | Cube corridor with doors and shoe racks | inside the demo cube (toward F6-26, the third door) | — |

  The yellow room-range signs are large and clear, so OCR on the hallway stairs should be strong. The SE route (car park → SE entrance → floor 1 hallway → lift → floor 5 lobby → SE hallway → stair 2 → cube) is now covered end to end. **Still nice to have:**
  - more car park photos near where the learner parks
  - the SW entrance and the B2 lift lobby (for the SW route)
  - the floor 1 lift lobby
  - a sharper shot of the floor 5 lift lobby

  With the SW car park, the route starts **SW entrance (B2) → lift B2 → 5 → turn right → SE hallway**. The Route Planner chooses between that and the SE entrance (floor 1) based on where the car is.

- **Room F6-26 inside its cube** (confirmed by the learner): it's the **third door you pass** after walking into the cube. The `cube` diagram's final step should highlight the third door along the walk-in path ("Third door: F6-26").

  Build `dorm-map.json` from the learner's answers and photos, never from guesses.

### Reference photos: `public/reference/*.jpg` + `public/data/reference-photos.json`
`[{ "file": "zone-c-1.jpg", "spotId": "cp-zone-c" }, …]`. Each spot can have 1–3 photos. Every spot where someone might snap (parking zones, lobbies, the room corridor) needs at least one photo.

### Embeddings: `public/data/embeddings.json`
Generated by the setup script, never hand-edited: `[{ "file", "spotId", "vector": [512 numbers] }]`.

### Parkings (Firestore): `users/{uid}/parkings/{parkingId}`
| Field | Type | Notes |
|---|---|---|
| `spotId` | string | map spot |
| `label` | string | e.g. "Car Park · Zone C" |
| `thumb` | string | base64 JPEG thumbnail |
| `gps` | `{lat,lng,accuracy}` or null | supporting only |
| `status` | `"current"` or `"history"` | at most one `current` |
| `createdAt` | timestamp | shown in history |
| `endedAt` | timestamp or null | set on Arrived |

**Where it lives and what happens when you come back:** the records live in Firestore under this phone's anonymous user, and they're read again whenever Home opens. The anonymous sign-in is remembered by the browser, so the same phone sees the same parkings after closing and reopening. Clearing the browser's site data would create a new anonymous user, and the old parkings would no longer be visible.

### Trip (sessionStorage)
This is temporary and is lost when the tab closes. See [Trip State](#trip-state).

### Security rules: `firestore.rules`
```
match /users/{uid}/parkings/{id} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## File Structure

The app lives in a `wayback/` folder at the repo root, next to `devpost/` (planning docs).

```
wayback/
├── app/
│   ├── layout.tsx            # fonts (Orbitron, Inter), dark theme, TripProvider
│   ├── globals.css           # Tailwind v4 @theme: palette, glow shadows, pulse/scan
│   ├── page.tsx              # Home Screen
│   ├── locate/page.tsx       # Locate Flow (park | car | help)
│   ├── destination/page.tsx  # Destination Screen
│   └── directions/page.tsx   # Directions Screen
├── components/
│   ├── CaptureButton.tsx     # camera file input
│   ├── ParkingCard.tsx       # current parking card / empty state
│   ├── HistoryList.tsx       # history rows
│   ├── GuessCard.tsx         # labelled reference-photo guess
│   ├── SpotListPicker.tsx    # last-resort list grouped by floor
│   ├── StepDiagram.tsx       # SVG templates: lifts, turn, lift-ride, door, walk, arrive
│   ├── Building3D.tsx        # three.js whole-building view, dive-in and follow camera
│   ├── RouteSim.tsx          # 2D floor plan view with the route
│   └── HudPanel.tsx          # shared glowing panel frame
├── lib/
│   ├── firebase.ts           # init, anonymous auth, Firestore + offline cache
│   ├── parkings.ts           # Parking Store functions
│   ├── matcher.ts            # Location Matcher (CLIP + OCR + scoring)
│   ├── clip.worker.ts        # runs CLIP in a Web Worker
│   ├── pendingPhoto.ts       # hands the Home photo to the Locate screen
│   ├── scoring.ts            # cosine similarity + sign bonus (pure, tested)
│   ├── route.ts              # Route Planner (Dijkstra, steps; pure, tested)
│   ├── map.ts                # loads dorm-map.json, spot lookups
│   ├── building.ts           # every floor generated from the layout rules (pure, tested)
│   ├── image.ts              # resize photo, make thumbnail
│   ├── gps.ts                # GPS Stamp
│   └── trip.ts               # Trip State store (useSyncExternalStore) + sessionStorage
├── public/
│   ├── data/
│   │   ├── dorm-map.json         # hand-written map
│   │   ├── reference-photos.json # photo → spot tags
│   │   └── embeddings.json       # generated
│   └── reference/            # ~10–20 dorm photos
├── scripts/
│   ├── build-embeddings.mjs  # Embeddings Setup Script
│   ├── clip.mjs              # Node CLIP helpers shared by the scripts
│   └── check-match.mjs       # altered-photo match check (npm run check:match)
├── tests/
│   ├── route.test.ts
│   ├── building.test.ts
│   └── scoring.test.ts
├── firestore.rules
├── .env.local.example        # NEXT_PUBLIC_FIREBASE_* names, no values
├── package.json              # scripts: dev, build, test, embeddings
├── README.md                 # what it is, setup, how to run, demo link

```

## External Services and Dependencies

### Firebase (Firestore + Anonymous Auth)
- **Calls (JS SDK, no raw endpoints):**
  - `signInAnonymously(auth)`
  - `addDoc(collection(db, "users", uid, "parkings"), {...})`
  - `query(..., where("status","==","current"))`
  - `query(..., where("status","==","history"), orderBy("createdAt","desc"))`, which may need a composite index; the console error gives a link to create it
  - `updateDoc(ref, {status:"history", endedAt: serverTimestamp()})`
- **Keys:** the web config from the Firebase console, in `NEXT_PUBLIC_FIREBASE_*`. These are safe to be public, because the security rules do the protecting.
- **Cost:** the Spark free tier (daily read/write quotas far above demo use).
- **Not used:** Cloud Storage (it needs the Blaze plan).

### Hugging Face model files (via Transformers.js)
- **What happens:** the browser downloads the CLIP model files from the Hugging Face Hub on first use, then caches them.
- **Call:** `pipeline("image-feature-extraction", "<clip model id>")` → `output.data` (512 numbers). Verify the exact task or class for CLIP image embeddings early. The fallback is `CLIPVisionModelWithProjection` + `AutoProcessor`.
- **Keys and cost:** none needed; free.

### Tesseract.js
- **Call:** `Tesseract.recognize(image, "eng")` → `data.text` → split into words.
- **Where it runs:** in the browser (WASM). It downloads its language data on first use.
- **Cost:** free.

### Firebase Hosting
- **Setup:** Spark plan (free), project `wayback-m06-1626`. `firebase.json` serves `out/` with clean URLs; deploy with `firebase deploy --only hosting` after `npm run build`. The Firebase config is baked into the build from `.env.local`.

## Important Failure Modes

- **CLIP is slow or fails to load on the phone (first visit, weak signal)** → show "Waking up the AI…" with progress. If it fails, offer **pick from list** right away, so the trip never dead-ends. Open the app once on Wi-Fi before the demo so the model is cached.
- **The match is wrong (lighting, night, an angle not in the reference photos)** → the PRD's fix chain: other guesses → sign photo → list. Take reference photos from the angles a user would actually stand at, and add a second photo for confusing spots.
- **OCR reads nothing or nonsense** → no bonus is added and the matching uses images only. The sign-photo step still re-runs matching, and if nothing fits, the list picker appears.
- **Firestore offline or slow** → offline persistence saves locally and syncs later, so the UI moves on immediately after ✓.
- **Room not on the map** → an inline "Wayback doesn't know room ___ yet" message, then ask again.

## What Was Simplified and Why

- **Photos are stored as small thumbnails inside Firestore records** instead of in Cloud Storage. Cloud Storage now needs the Blaze plan, and the thumbnails are enough for the history list. The fuller version would mean upgrading to Blaze and uploading full photos.
- **Step pictures are drawn SVG templates** instead of a 3D/Unity-style scene or photos with markers (learner's choice). They're simple, match the HUD look, and need no extra setup. The fuller version would need a 3D engine or hand-placed markers on photos.
- **"Next" button steps** instead of live tracking (from the PRD).
- **One hand-made map and photo set for the dorm demo path** instead of AI-built maps (from scope).
- **Embeddings are computed once by a script** instead of a server with a vector database. With ~20 photos a JSON file and a simple loop are enough, and it's the same retrieval idea at a small scale.
- **There's no confidence threshold.** The user always confirms, so the ranked order is all that's needed.

## Decisions and Open Issues

**Learner decisions**
- **Next.js + React + Tailwind**, the learner's familiar stack, as a phone-browser web app.
- **Firebase** for parkings, chosen over browser storage because the learner already uses it and it's free. Tradeoff: setup, keys, and rules.
- **Matching in the browser + hosting on Firebase Hosting** (Vercel at planning time; switched during the build by the learner). Tradeoff: a slow first load on the phone.
- **The car park is outdoors**, so signal for Firebase saves is fine.
- **Drawn diagrams, "like Unity but simple"**, instead of real photos with markers.

**Agent recommendations carried in (change them at review if you like)**
- **Thumbnail-in-Firestore + anonymous auth**, to stay on the free plan with private records.
- **The palette and fonts**, since the PRD left colours open.
- **Capturing while a parking is already current** (`prd.md > Open Questions`): the old one moves to history automatically. That's the simplest choice, and nothing is lost.
- **One photo per capture**, not frames (`prd.md > Open Questions`).

**Useful unknown, clarified**
The learner thought browser storage loses data on refresh. In fact it survives refreshes, closing the browser, and restarting the phone. It's lost only in incognito, when site data is cleared, or possibly after ~7 days unused on iPhone Safari. What resets on refresh is React state (`useState`). The learner chose Firebase anyway. The same idea shows up in [Trip State](#trip-state): sessionStorage is used so a refresh mid-route keeps your place. During the build, check it by refreshing on the Directions screen.

**Open issues (none block the build)**
- Verify the library versions, the CLIP model ID and size, and the browser support (see [Stack](#stack)).
- Tune the sign bonus and the reference photo angles at the dorm.
- GPS in an outdoor car park could later help narrow the zone. For now it's supporting only, as the PRD says.
