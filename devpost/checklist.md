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

- [x] **2. Type your room and follow the steps there**
  Becomes usable: After ✓ on a parking guess, you type `F6-26` and walk through the shortest route one step at a time — car park → SE entrance → lift lobby → Lift to 5 → turn right → SE hallway → stair 2, half a flight up → third door — each with a glowing diagram, Next, and "Step 2 / 7".
  Why now: The route is the second half of the kernel. Doing it right after matching means the full "where am I → how do I get there" idea works on screen early, before storage or polish.
  PRD ref: `prd.md > The Core Journey` (steps 4–6), `prd.md > Guiding to a Room`, `prd.md > States and Boundaries` (room not on the map)
  Spec ref: `spec.md > Components` (Destination Screen, Directions Screen, Route Planner, Step Diagram, Trip State), `spec.md > Data Model` (Dorm map, Demo building), `spec.md > Important Failure Modes`
  Build: Add the links to `dorm-map.json` from the spec's demo-building facts, both directions, including both car park entrances (SE floor 1, SW B2) so "shortest" is a real choice; ask you about any gap rather than guessing. Build `lib/map.ts`, `lib/route.ts` (`findRoom` accepting `F6-26`, Dijkstra, `toSteps`) with Vitest tests, `lib/trip.tsx` mirrored to sessionStorage, the Destination screen with the unknown-room message, the Directions screen, and the `StepDiagram` templates (lifts, turn, lift-ride, door, walk, stairs, half-stairs, cube, arrive). ✓ in park mode goes to Destination.
  Verify (mechanical): `npm test` passes route tests (F6-26 found, unknown room is null, the SE car park route uses the SE entrance, the SW car park route uses the SW entrance and B2 lift, reverse route is the mirror with flipped turns); `npm run build` passes; in the browser, typing `F6-26` gives the expected steps and refreshing mid-route keeps your step.
  Learner check: Confirm a parking guess, type `F6-26`, step through the directions, and say whether each step matches what you'd actually do in M06; then type a made-up room and see the "doesn't know room" message.
  Commit: `Route from parking spot to a room with step diagrams`

- [x] **3. See the whole building in 3D and dive into your route**
  Becomes usable: Directions opens on a full-height, game-like 3D view of the whole M06 block — every floor from B2 to 10 with its lift lobby, the X of hallways and the 32 split-level cubes — then the camera dives into your floor and follows the glowing route step by step. A 2D toggle shows the full plan of the floor you're on.
  Why now: You asked for an immersive, game-like view of the exact building structure. It goes before the phone test so that test also tells us whether the 3D scene and CLIP run smoothly together on your phone.
  PRD ref: `prd.md > The Core Journey` (steps 4–6), `prd.md > Guiding to a Room`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > Look and Feel`, `spec.md > Components` (Screens, Step Diagram), `spec.md > Data Model` (Dorm map, Demo building)
  Build: `lib/building.ts` generates every floor from the layout rules (lobby, X hallways, 4 stairs per hallway, lower/upper cubes half a flight off the hallway); spot positions and half-levels in `dorm-map.json`; three.js + react-three-fiber `components/Building3D.tsx` with a tower overview, a dive-in camera and a camera that follows the route; `components/RouteSim.tsx` as the 2D floor plan; Directions screen with a large immersive view above the step text and photo.
  Verify (mechanical): `npm test` passes building tests (32 cubes per floor, the demo cube on the left of SE stair 2 half a flight above floor 5); `npm run build` passes; in the browser, the F6-26 route shows the overview, dives in, follows Next/Back and Play, the 2D toggle works, and there are no console errors.
  Learner check: Run `npm run dev`, type `F6-26` from a parking guess, watch the building overview and the dive, step through the route, switch to 2D, and say whether it feels like the game you pictured and whether the structure looks like M06.
  Commit: `Show the whole building in 3D and dive into the route`

- [ ] **4. Your parking is remembered after you close the app**
  Becomes usable: Confirming a parking saves it. Home shows the Current Parking card with the label, photo thumbnail and time, and it's still there after you close and reopen the app. Capturing a new parking moves the old one into Parking History.
  Why now: You asked to make the whole navigation work before the phone test, and saving the car is its first piece. Firebase is familiar to you and low-risk, but it needs your Firebase project and keys.
  PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Screens and Layout` (Home), `prd.md > States and Boundaries` (first use, parked, coming back later)
  Spec ref: `spec.md > Components` (Parking Store, GPS Stamp, Home Screen), `spec.md > Data Model` (Parkings, Security rules), `spec.md > External Services and Dependencies` (Firebase), `spec.md > What Was Simplified and Why`
  Build: You create the Firebase project (Spark plan, Firestore, Anonymous sign-in, web app) and put the config in `.env.local`; I add `.env.local.example`, `lib/firebase.ts` with anonymous auth and offline cache, `lib/parkings.ts`, `lib/gps.ts`, thumbnails in `lib/image.ts`, `firestore.rules`, and `ParkingCard` and `HistoryList` on Home. (The same env vars go into Vercel in slice 7.)
  Verify (mechanical): `npm run build` passes; in the browser, confirming a parking writes one `current` record under the anonymous user, a reload still shows it, a second capture leaves exactly one `current` and moves the old one to `history`; `.env.local` is ignored by git.
  Learner check: Capture and confirm a parking, close the tab, reopen the app, and check the card is still there with your photo; then capture again and see the first one move to history.
  Commit: `Save current parking and history in Firestore`

- [ ] **5. Find my car, get help, and arrive**
  Becomes usable: The whole loop, on the laptop. "Find my car" asks you to snap where you are, locates you (with the same fixes), and walks you back by the shortest route. Help on any step re-locates you and gives fresh steps. After a lift or stairs step the app asks you to confirm the floor you're on ("On Floor 5 now?"), with "Not sure" to snap the lobby or a sign. Arrived on the last step ends the parking, moves it to history, and empties the card.
  Why now: It reuses matching, routing and storage and completes the journey you asked for; the wrong-guess fixes (slice 8) slot in later.
  PRD ref: `prd.md > The Core Journey` (steps 7–10), `prd.md > Finding the Car`, `prd.md > Help While Walking`, `prd.md > Arriving and Parking History`, `prd.md > Guiding to a Room` (changing floors)
  Spec ref: `spec.md > Components` (Locate Flow `car`/`help` modes, Directions Screen, Parking Store `endParking`, Trip State)
  Build: Wire Locate Flow `mode=car` and `mode=help`, route from "you are here" to the parked spot or the current destination, Arrived → `endParking` → Home, Done for room trips, and the floor confirm after lift/stairs steps.
  Verify (mechanical): `npm test` and `npm run build` pass; in the browser, Find my car from a floor 5 lobby photo gives the reverse route to the parked spot, Help mid-route gives fresh steps to the same destination, the lift step asks to confirm the floor, and Arrived leaves no `current` parking and one new history row.
  Learner check: On the laptop, capture a parking, go to F6-26 (confirming the floor after the lift), then Find my car with a photo from the path, follow it back, and tap Arrived.
  Commit: `Add find my car, help, and arrived`

- [ ] **6. Capture four sides, pinned by GPS**
  Becomes usable: Capture (parking, Find my car, Help / "I'm lost") guides you through four photos — front, right, back, left — and matches them together, so a spot must look right from several directions. When your phone has an accurate GPS fix and the building's GPS anchors are set, spots far from you are ruled out first. You can skip the remaining sides.
  Why now: You asked for it to make locating reliable in identical-looking hallways and car park bays, and so being lost always leads back to a route. It builds on the matcher and the Help flow from slice 5.
  PRD ref: `prd.md > Capturing the Parking Spot`, `prd.md > Help While Walking`, `prd.md > States and Boundaries` (no GPS signal)
  Spec ref: `spec.md > Components` (Location Matcher — four-side capture, GPS Stamp), `spec.md > Data Model` (Reference photos, Embeddings)
  Build: Locate Flow four-shot capture with a side guide and Skip; `lib/scoring.ts` combines per-photo scores per spot (average) and filters by GPS distance when accuracy ≤ 20 m (pure, tested); `lib/gps.ts` converts lat/lng to map metres from `public/data/gps-anchors.json` (empty until the phone test, so the pin is off); Home, Find my car and Help use the same capture.
  Verify (mechanical): `npm test` passes scoring tests (the spot that matches most of the four photos beats one lucky match; a far spot is dropped with an accurate fix; no anchors or poor accuracy changes nothing); `npm run build` passes; in the browser, four reference photos from one spot give that spot, and Skip after one photo still works.
  Learner check: Capture with four of your dorm photos on the laptop, then try Skip after one, and say whether the side guide is clear and the guess right.
  Commit: `Capture four sides and pin with GPS`

- [ ] **7. Open Wayback on your phone at the dorm**
  Becomes usable: A real `https://` link that opens on your phone, uses the phone camera, runs the AI matching (four photos) and the 3D view on the phone itself, and has the GPS pin switched on.
  Why now: Everything you asked for is in, so this tests it for real. CLIP (four photos) plus the 3D view on a phone is the biggest unknown left, and the dorm visit also collects the GPS anchor readings and settles the open building details (which cubes are mirrored, the way into F6-26).
  PRD ref: `prd.md > The Core Journey` (steps 1–6), `prd.md > Capturing the Parking Spot`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies` (Vercel, Hugging Face model files), `spec.md > Important Failure Modes` (CLIP slow or fails)
  Build: Add a `README.md` with how to run it. Push the project to a GitHub repo (private is fine for now) and deploy it on Vercel — you sign in to GitHub and Vercel yourself. Make sure the model loads with download progress. Add the Firebase env vars in Vercel. At the dorm, take GPS readings at two or three known spots for `gps-anchors.json`.
  Verify (mechanical): The Vercel build succeeds; the deployed URL returns the Home page, `public/data/embeddings.json` and a reference photo; a deployed-page browser check runs a match without errors.
  Learner check: On your phone at the dorm, do the full demo: capture the parking (four sides), go to F6-26, then Find my car from somewhere on the path, follow it back and tap Arrived. Tell me where guesses were wrong, how long matching took, and whether the 3D view stayed smooth.
  Commit: `Add README and deployment notes for phone testing`

- [ ] **8. Fix a wrong guess: other guesses, sign photo, pick from list**
  Becomes usable: When the guess is wrong you tap "No, that's wrong" and pick from the next best photos; if none fit, you snap a sign and it re-matches using the sign's text; if that still fails, you pick your spot from a list grouped by floor. Visible signs like "F6-25 - F6-28" now boost the right guess on every match.
  Why now: Slice 7 shows how often matching is wrong in real life. This slice makes sure no wrong guess ever leaves you stuck, and adds the sign reading that matters most in identical-looking hallways.
  PRD ref: `prd.md > Fixing a Wrong Location`, `prd.md > Capturing the Parking Spot` (readable sign helps the guess), `prd.md > States and Boundaries` (unsure match)
  Spec ref: `spec.md > Components` (Locate Flow steps 4–6, Location Matcher), `spec.md > External Services and Dependencies` (Tesseract.js), `spec.md > Important Failure Modes`
  Build: Add Tesseract.js OCR to `lib/matcher.ts` and the sign bonus to `lib/scoring.ts` (with tests), then Other Guesses (`GuessCard`), the sign-photo step, and `SpotListPicker`. Tune the sign bonus against the real sign photos.
  Verify (mechanical): `npm test` passes scoring tests (a matching sign word lifts the right spot; nonsense OCR changes nothing); a Node or browser run shows OCR reading "F6-25" from the SE stair 2 photo; in the browser, every fix path ends in a confirmed spot.
  Learner check: Snap a photo, tap "No, that's wrong", try picking another guess, then try "None of these" with a sign photo, then the list — and say whether any path felt slow or confusing.
  Commit: `Add guess fixes, sign reading, and list picker`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 7, on your phone at the dorm (matching accuracy and photo angles can still change the wrong-guess fixes in slice 8)
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
- Car park entrances and the B2 path (SW/NW entrance → B2 hallway → B2 lift lobby) built from the spec's facts after two unanswered questions — the B2 hallway leg and all walking costs are assumptions to confirm on the phone at the dorm in slice 3. Lift steps say "any lift" instead of highlighting one, since all four lifts stop at the same floors; the floor 5 turn follows the "F6-25 – F6-40 →" sign rather than left/right, because the lifts face each other.
- Trip State is a small `useSyncExternalStore` store in `lib/trip.ts` instead of a React context provider — same sessionStorage behavior with less wiring.
- New slice 3 (whole-building 3D, dive-in camera) added before the phone test at the learner's request — they wanted a game-like, immersive view showing the exact building structure rather than only the route. Later slices renumbered 4–7; the early hands-on checkpoint moves to after slice 4.
- three.js + @react-three/fiber added to the stack for the 3D view (learner agreed after hearing the cost: a new library and a heavier load on the phone next to CLIP). No drei, to keep the bundle small. The 2D view stays the lighter CSS/SVG plan.
- Floors assumed B2, B1, 1–10 (lifts stop at 9, even floors by stairs) — learner confirmed every floor has the same layout; the floor list is one constant in `lib/building.ts`.
- Cube F6-25 – 28 moved to the left of SE stair 2 in the map to match the "stairs on your left" directions; cube and room spots now sit half a flight (level 4.5) above the floor 5 hallway.
- Learner feedback on slice 3 added: drag to spin / pinch or scroll to zoom with a recenter button, full-screen 3D with the step text and controls inside it, a floating YOU tag plus the place name in the floor chip, and stairs drawn step by step (each cube's half flight, the switchback at each hallway end).
- A simple "↩ CAR PARK" button pulled forward from slice 7: it routes from where you are on the current trip back to the car park that trip started from. Slice 7 still adds Find my car from a photo and the saved parking.
- Cube interiors from the learner's floor plan (two floors: toilet and stairs either side of the entry gap, swapped upstairs; rooms 4 and 1 at the ends, 3 and 2 along the back). Only the cube on your route is drawn in detail and in bright colour; the rest of the structure is calm steel. The camera comes in close over that cube. F6-26 is assumed to be room 2 (25–28 → rooms 1–4) — to confirm with the learner.
- Cubes on opposite sides of a hallway drawn as mirror images (learner: stairs are on the right in some cubes, left in others); the demo cube F6-25 – 28 has its stairs on your right as you walk in. Exactly which cubes are mirrored, and what you see at the top of the cube stairs, are to be checked at the dorm during slice 4.
- Cubes restacked (learner): the stair 1 cube is directly under the stair 2 cube, and the stair 4 cube under the stair 3 cube, so each side of a hallway has two stacks centred between their stairs; the old "upper cubes set further back" spacing is gone. Demo cube and F6-26 spots moved to match.
- F6-26 is room 3 on the cube plan (learner: the middle door in their corridor photo), replacing the room 2 guess; the room to light up is now picked from the room spot's position. Directions updated to "Walk in, turn left along the corridor: F6-26 is the middle door on your right" — to confirm at the dorm.
- Each cube now has one straight stair from the hallway (learner): facing a stack, stairs 1 and 3 come in on the left, 2 and 4 on the right, so the two cubes of a stack are mirror images. This replaces the earlier mirror-across-the-hallway guess. SE stair spots moved to where those stairs start.
- Learner feedback: each hallway stair now arrives near the end of its cube on its own side (the open corner above the end room) instead of the middle gap; one stair inside each cube instead of two half flights; cubes enlarged from 12 × 5 m to 16 × 7 m with the plan scaled to fit. Spots moved to match.
- Inner cube stair removed from the drawing (learner: it led nowhere); the only stair shown for a cube is the one from the hallway.
- When heading to a cube, the stair from the next hallway that lands on your cube's level is hidden (learner circled it in a screenshot: it looked like a second stair into the cube, leading nowhere). The stair from your own hallway into the cube below stays.
- Rooms set back inside the cube (learner: the stair ran straight into the room) — about 2.6 m of corridor now separates the top of the hallway stair from the end room; plan depth 5 → 6.2 plan-metres, same cube size.
- Cubes that aren't on your route are greyed out (neutral grey) on your floor too (learner); only the hallway and your own cube stay in colour up close.
- Plan reordered at the learner's request after slice 3: save my car (4) → find my car, help, arrive (5) → four-side capture pinned by GPS (6, new) → phone test at the dorm (7) → wrong-guess fixes (8). Tradeoff explained: we learn later whether four photos plus 3D run fast enough on the phone.
- Four-side capture added (learner): front, right, back, left matched together. GPS becomes a pin when accurate (≤ 20 m), via GPS anchors collected at the dorm; it never decides the floor. Floor changes are confirmed by the user after lift/stairs steps rather than detected (a web page can't read the barometer, and motion sensing is unreliable). PRD and spec updated to match.
