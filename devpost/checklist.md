---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Snap a photo and see the AI's guess of where you are**
  Becomes usable: The Wayback Home screen opens in the dark HUD look with a big Capture button. You pick or take a dorm photo, the app shows "Waking up the AI…" and then a Location Result with the AI's top guess (e.g. "SE Hallway · Stair 2") next to the reference photo it matched.
  Why now: This is the unique kernel and the riskiest piece. CLIP running in the browser and matching your dorm photos is what everything else depends on, so we find out first whether it works. Project setup (Next.js, Tailwind, fonts, palette) happens inside this slice.
  PRD ref: `prd.md > The Core Journey` (steps 1–3), `prd.md > Capturing the Parking Spot`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > Look and Feel`, `spec.md > Components` (Home Screen, Locate Flow steps 1–3, Location Matcher, Embeddings Setup Script), `spec.md > Data Model` (Reference photos, Embeddings, Demo building photo inventory), `spec.md > File Structure`
  Build: Scaffold the Next.js + TypeScript + Tailwind app in this folder per the file structure, with the palette, Orbitron/Inter fonts, glow utilities and `HudPanel`. Check current versions of Next.js and Transformers.js and the CLIP model ID and size. Move the reference photos from `reference-inbox/` into `public/reference/` with readable names, write the map spots they show into `public/data/dorm-map.json` (spots only, links come in slice 2), and tag them in `reference-photos.json` (the in-lift photo is an illustration only, not a match target). Write `scripts/build-embeddings.mjs` and `npm run embeddings`. Build `lib/image.ts`, `lib/scoring.ts` (cosine similarity, best photo per spot) and `lib/matcher.ts` (image score only for now). Home with Capture, and Locate Flow Snap → Working → Location Result with ✓ (✓ goes nowhere yet).
  Verify (mechanical): `npm run embeddings` writes one 512-number vector per tagged photo; a small Node check embeds a cropped and darkened copy of each reference photo and confirms its own spot is the top guess; `npm run build` passes; the dev server serves Home with no console errors, and uploading a reference-path photo in the browser shows the right top guess.
  Learner check: Run `npm run dev`, open `http://localhost:3000` in your browser's phone view, tap Capture, pick one of your dorm photos, and see whether the guess and matched photo are right and whether the look feels like the HUD you pictured.
  Commit: `Match a snapped photo to a dorm spot with in-browser CLIP`

- [ ] **2. Type your room and follow the steps there**
  Becomes usable: After ✓ on a parking guess, you type `F6-26` and walk through the shortest route one step at a time — car park → SE entrance → lift lobby → Lift to 5 → turn right → SE hallway → stair 2, half a flight up → third door — each with a glowing diagram, Next, and "Step 2 / 7".
  Why now: The route is the second half of the kernel. Doing it right after matching means the full "where am I → how do I get there" idea works on screen early, before storage or polish.
  PRD ref: `prd.md > The Core Journey` (steps 4–6), `prd.md > Guiding to a Room`, `prd.md > States and Boundaries` (room not on the map)
  Spec ref: `spec.md > Components` (Destination Screen, Directions Screen, Route Planner, Step Diagram, Trip State), `spec.md > Data Model` (Dorm map, Demo building), `spec.md > Important Failure Modes`
  Build: Add the links to `dorm-map.json` from the spec's demo-building facts, both directions, including both car park entrances (SE floor 1, SW B2) so "shortest" is a real choice; ask you about any gap rather than guessing. Build `lib/map.ts`, `lib/route.ts` (`findRoom` accepting `F6-26`, Dijkstra, `toSteps`) with Vitest tests, `lib/trip.tsx` mirrored to sessionStorage, the Destination screen with the unknown-room message, the Directions screen, and the `StepDiagram` templates (lifts, turn, lift-ride, door, walk, stairs, half-stairs, cube, arrive). ✓ in park mode goes to Destination.
  Verify (mechanical): `npm test` passes route tests (F6-26 found, unknown room is null, the SE car park route uses the SE entrance, the SW car park route uses the SW entrance and B2 lift, reverse route is the mirror with flipped turns); `npm run build` passes; in the browser, typing `F6-26` gives the expected steps and refreshing mid-route keeps your step.
  Learner check: Confirm a parking guess, type `F6-26`, step through the directions, and say whether each step matches what you'd actually do in M06; then type a made-up room and see the "doesn't know room" message.
  Commit: `Route from parking spot to a room with step diagrams`

- [ ] **3. Open Wayback on your phone at the dorm**
  Becomes usable: A real `https://` link that opens on your phone, uses the phone camera, and runs the AI matching on the phone itself.
  Why now: The phone is where this app lives, and CLIP on a phone browser (speed, model download, WASM fallback) is the biggest unknown left. Testing at the dorm now tells us whether the reference photos and angles are good enough while there's still time to retake them.
  PRD ref: `prd.md > The Core Journey` (steps 1–6), `prd.md > Capturing the Parking Spot`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies` (Vercel, Hugging Face model files), `spec.md > Important Failure Modes` (CLIP slow or fails)
  Build: Add a `README.md` with how to run it. Push the project to a GitHub repo (private is fine for now) and deploy it on Vercel — you sign in to GitHub and Vercel yourself. Make sure the model loads with download progress and falls back to WASM when WebGPU is missing.
  Verify (mechanical): The Vercel build succeeds; the deployed URL returns the Home page, `public/data/embeddings.json` and a reference photo; a deployed-page browser check runs a match without errors.
  Learner check: Open the link on your phone, snap three real spots on the demo path (car park, floor 5 lobby, SE stair 2), and tell me for each one whether the guess was right and how long it took.
  Commit: `Add README and deployment notes for phone testing`

- [ ] **4. Fix a wrong guess: other guesses, sign photo, pick from list**
  Becomes usable: When the guess is wrong you tap "No, that's wrong" and pick from the next best photos; if none fit, you snap a sign and it re-matches using the sign's text; if that still fails, you pick your spot from a list grouped by floor. Visible signs like "F6-25 - F6-28" now boost the right guess on every match.
  Why now: Slice 3 shows how often matching is wrong in real life. This slice makes sure no wrong guess ever leaves you stuck, and adds the sign reading that matters most in identical-looking hallways.
  PRD ref: `prd.md > Fixing a Wrong Location`, `prd.md > Capturing the Parking Spot` (readable sign helps the guess), `prd.md > States and Boundaries` (unsure match)
  Spec ref: `spec.md > Components` (Locate Flow steps 4–6, Location Matcher), `spec.md > External Services and Dependencies` (Tesseract.js), `spec.md > Important Failure Modes`
  Build: Add Tesseract.js OCR to `lib/matcher.ts` and the sign bonus to `lib/scoring.ts` (with tests), then Other Guesses (`GuessCard`), the sign-photo step, and `SpotListPicker`. Tune the sign bonus against the real sign photos.
  Verify (mechanical): `npm test` passes scoring tests (a matching sign word lifts the right spot; nonsense OCR changes nothing); a Node or browser run shows OCR reading "F6-25" from the SE stair 2 photo; in the browser, every fix path ends in a confirmed spot.
  Learner check: Snap a photo, tap "No, that's wrong", try picking another guess, then try "None of these" with a sign photo, then the list — and say whether any path felt slow or confusing.
  Commit: `Add guess fixes, sign reading, and list picker`

- [ ] **5. Your parking is remembered after you close the app**
  Becomes usable: Confirming a parking saves it. Home shows the Current Parking card with the label, photo thumbnail and time, and it's still there after you close and reopen the app. Capturing a new parking moves the old one into Parking History.
  Why now: The route and matching now work, so saving their result is next. Firebase is familiar to you and low-risk, but it needs your Firebase project and keys, so it waits until the core works.
  PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Screens and Layout` (Home), `prd.md > States and Boundaries` (first use, parked, coming back later)
  Spec ref: `spec.md > Components` (Parking Store, GPS Stamp, Home Screen), `spec.md > Data Model` (Parkings, Security rules), `spec.md > External Services and Dependencies` (Firebase), `spec.md > What Was Simplified and Why`
  Build: You create the Firebase project (Spark plan, Firestore, Anonymous sign-in, web app) and put the config in `.env.local`; I add `.env.local.example`, `lib/firebase.ts` with anonymous auth and offline cache, `lib/parkings.ts`, `lib/gps.ts`, thumbnails in `lib/image.ts`, `firestore.rules`, and `ParkingCard` and `HistoryList` on Home. Add the same env vars in Vercel.
  Verify (mechanical): `npm run build` passes; in the browser, confirming a parking writes one `current` record under the anonymous user, a reload still shows it, a second capture leaves exactly one `current` and moves the old one to `history`; `.env.local` is ignored by git.
  Learner check: Capture and confirm a parking, close the tab, reopen the app, and check the card is still there with your photo; then capture again and see the first one move to history.
  Commit: `Save current parking and history in Firestore`

- [ ] **6. Find my car, get help, and arrive**
  Becomes usable: The whole loop. "Find my car" asks you to snap where you are, locates you (with the same fixes), and walks you back by the shortest route. Help on any step re-locates you and gives fresh steps. Arrived on the last step ends the parking, moves it to history, and empties the card.
  Why now: It reuses everything already built — matching, fixes, routing, storage — so it's the last piece, and it completes the demo journey.
  PRD ref: `prd.md > The Core Journey` (steps 7–10), `prd.md > Finding the Car`, `prd.md > Help While Walking`, `prd.md > Arriving and Parking History`
  Spec ref: `spec.md > Components` (Locate Flow `car`/`help` modes, Directions Screen, Parking Store `endParking`, Trip State)
  Build: Wire Locate Flow `mode=car` and `mode=help`, route from "you are here" to the parked spot or the current destination, Arrived → `endParking` → Home, Done for room trips, and redeploy.
  Verify (mechanical): `npm test` and `npm run build` pass; in the browser, Find my car from a floor 5 lobby photo gives the reverse route to the parked spot, Help mid-route gives fresh steps to the same destination, and Arrived leaves no `current` parking and one new history row.
  Learner check: On your phone at the dorm, do the full demo: capture the parking, go to F6-26, then Find my car from somewhere on the path, follow it back, and tap Arrived.
  Commit: `Add find my car, help, and arrived`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3, on your phone at the dorm (matching accuracy and photo angles can still change the rest of the build)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- App code moved into a `wayback/` folder next to `devpost/` — learner asked for one folder holding the code that goes to GitHub; Vercel will build from `wayback/` as its root directory.
- Transformers.js v4 instead of v3, CLIP always on WASM (q8) in a Web Worker instead of WebGPU-first — v4 is the current release, and the q8 model is the same file the embeddings script uses, so browser and Node vectors line up (WebGPU would load a different 350 MB fp32 file).
- Tailwind v4 theme lives in `app/globals.css` (`@theme`), no `tailwind.config.ts` — Tailwind v4 dropped the JS config file.
- Vitest 4 instead of 5 — Vitest 5 needs Node 22+, and this machine has Node 20.16; `.npmrc` sets `legacy-peer-deps` and the Windows rolldown binding is pinned to work around an npm 10.8 install bug.
- The NE and SW cube photos aren't in the reference set yet, and SE stairs 1–3 match each other closely (0.786 vs 0.775 for stair 2) — sign reading in slice 4 is what separates them.

