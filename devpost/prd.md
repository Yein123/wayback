---
doc: prd
status: approved
---

# Wayback — Product Requirements

A phone app that remembers where you parked inside a building GPS can't see, guides you to your room, and later walks you back to your car step by step, using a photo instead of GPS. It's for someone new to a large multi-floor building with a car park; the demo is the learner's dorm.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Open Wayback** → the Home screen shows a **Capture** button, the **Current Parking** card (empty on first use), and the **Parking History** list.
2. **Tap Capture** → take one photo of the parking spot's surroundings.
3. **AI places the car** → it matches the photo against the dorm's reference photos and reads any visible sign text, then shows its guess (e.g. "B1 · Zone C") with the matched photo.
4. **Confirm** → tap ✓. If the guess is wrong, use the fixes in [Fixing a Wrong Location](#fixing-a-wrong-location). The spot is saved as Current Parking.
5. **"Where are you going?"** → type a room number (e.g. 512).
6. **Follow the steps to the room** → each step shows a simple picture of that area with the right lift, door, or turn highlighted, plus a one-line instruction and **Next**.
7. *(Later)* **Tap "Find my car"** on the Current Parking card.
8. **Snap where you are** → the AI places *you* on the map and you ✓ confirm, with the same fixes if it's wrong.
9. **Follow the steps back to the car** → the shortest route uses the same step screens.
10. **Tap Arrived** → the parking moves into Parking History and the Current Parking card is empty again.

Success: the car's spot was pinned from one photo, and you reached the room and got back to the car by following the steps.

## Screens and Layout

| Screen | What's on it | How you get there / leave |
|---|---|---|
| **Home** | Capture button (main action) · Current Parking card (location label, photo, capture time, **Find my car** button) · Parking History list | App opens here. Arrived returns here. |
| **Location Result** | Photo you took · AI's guess as a label (e.g. "B1 · Zone C") with its matched reference photo · ✓ confirm · "No, that's wrong" | After Capture, after "Find my car" snap, after Help snap. |
| **Other Guesses** | Next best guesses as labelled reference photos to tap · "None of these" | From "No, that's wrong". |
| **Destination** | "Where are you going?" text box for a room number | After the parking spot is confirmed. |
| **Directions** | One step at a time: highlighted area picture · one-line instruction · Next · **Help** · on the last step, **Arrived** | After Destination (to room) or after locating yourself (to car). |

The **Parking History** list is view-only. Each row shows the date, time, matched location, and photo.

## Look and Feel
- **Futuristic AR / game feel**, inspired by AR games like Pokémon GO. It should feel like a sci-fi visor HUD, not a generic utility app.
- **Dark background** with glowing accent lines and highlights. The highlighted lift, door, or turn in each step should glow.
- Game-like, playful touches are welcome (rounded shapes, a sense of "quest" to the next step).
- It's a style only: no real camera AR overlay (see Deferred).
- *Assumption:* the specific glow colours are not chosen yet. `4-spec` can propose a palette within "glow on dark."

## Features and Behavior

### Capturing the Parking Spot
Source: `scope.md > The POC Boundary` (AI matches the parking capture).

- As a driver who just parked, I want to snap my surroundings and have the app know where my car is, so I don't need to remember the bay myself.
  - [ ] Tapping **Capture** on Home guides you through **four photos: front, right, back and left**. All four are matched together, so a spot has to look right from several directions. *(Learner, added during the build.)* You can skip the remaining sides if the first photos are enough.
  - [ ] The Location Result shows a readable label (floor + zone) and the reference photo it matched.
  - [ ] When the photo includes a readable sign (e.g. "B1", a pillar number), that text is used to help the guess.
  - [ ] A GPS position is saved with the capture when one is available. When it's accurate (roughly within 20 m), it **pins the area**: only spots near that position are considered. When it's poor or missing (underground, indoors), it's ignored. GPS never decides the floor.
  - [ ] Tapping ✓ saves it as **Current Parking**, and the Home card shows its label, photo, and time.

### Fixing a Wrong Location
Source: `scope.md > The POC Boundary` (safety net). This applies to every location match: parking, "Find my car", and Help.

- [ ] "No, that's wrong" shows the **next best guesses as labelled photos**. Tapping one confirms it.
- [ ] "None of these" asks for **a photo of a nearby sign board**, then matches again.
- [ ] If that still fails, the user can **pick the spot from a plain list** (e.g. "B1 · Zone A / B / C…"). *(Assumption, open to change.)*
- [ ] No path leaves the user stuck: every route ends in a confirmed location.

### Guiding to a Room
Source: `scope.md > The Core Loop` step 2, `scope.md > The POC Boundary` (shortest-route calculation).

- As a new resident, I want to type my room number and get clear steps, so I pick the right door, lift, and floor the first time.
  - [ ] After confirming the parking spot, the app asks "Where are you going?" and accepts a typed room number.
  - [ ] The route is the shortest path on the dorm map and is shown one step at a time.
  - [ ] Each step shows a simple picture of the area with the correct choice highlighted (e.g. 3 lifts, Lift 2 glowing) and one line of text (e.g. "Take Lift 2 up to Floor 5").
  - [ ] **Next** moves to the following step. The final step names the room.
  - [ ] **Changing floors:** after a lift or stairs step, the app asks you to confirm the floor you're now on (e.g. "On Floor 5 now?"). "Not sure" lets you snap the lobby or a sign to check. *(Learner: the app can't reliably detect a lift ride from a web page.)*

### Finding the Car
Source: `scope.md > The Core Loop` step 3, `scope.md > The POC Boundary` (way back: "where am I?" matching).

- As someone heading back to the car, I want to snap where I am and get the shortest way back, so I don't wander through the wrong lifts and floors.
  - [ ] **Find my car** on the Current Parking card asks for a photo of where you are.
  - [ ] The app locates you (Location Result + the same fixes), then shows the shortest route to the saved parking spot.
  - [ ] The route back is shown with the same step screens, and it works from any spot on the demo path, not just the room.
  - [ ] The last step offers **Arrived**.

### Help While Walking
- [ ] **Help** is available on every direction step. *(Assumption: the learner placed it at the arrival end, and it's extended here to every step.)*
- [ ] Help ("I'm lost") → capture the four sides where you are (plus GPS when accurate) → locate in the building (with the same fixes) → fresh steps from there to the same destination, or back to the car.

### Arriving and Parking History
- [ ] **Arrived** moves the Current Parking entry into **Parking History** and empties the Current Parking card.
- [ ] Parking History rows show date, time, location label, and photo, newest first. Rows are view-only.

### Adding a Building
Added during the build (learner): the first step of Wayback for any building.

- [ ] **ADD BUILDING** on Home opens your buildings and a form for a new one (its name).
- [ ] A building has floors, each with a label (B2, G, 1, 2…) and an uploaded image of that floor's plan, kept in the order added.
- [ ] Each floor's plan can be given a scale (two points and the metres between them) and outlines drawn over it (hallway, room, lobby, lift, stairs).
- [ ] The building's floors are shown stacked in 3D, raised from their outlines.
- [ ] Buildings are saved to the cloud under the person who made them; only they can change them.

## States and Boundaries
- **First use:** the Current Parking card shows an empty prompt to tap Capture, and Parking History is empty.
- **Parked:** the Current Parking card shows the spot with **Find my car**.
- **Unsure match:** the user is never forced to accept a guess. The fix sequence is other guesses → sign photo → pick from list.
- **No GPS signal (underground/indoors):** nothing changes for the user. GPS is supporting only.
- **Room number not on the map:** *Assumption:* the app says it doesn't know that room and asks again. The demo map only includes the rooms needed.
- **Coming back later:** Current Parking and Parking History are still there when the app is reopened.
- **Starting a new capture while a car is already parked:** *Open question* (see below).

## Product Decisions
- **Name: Wayback.** The learner kept the working name.
- **Home = Capture + Current Parking + Parking History.** Capturing comes first. History is kept simple: date, time, location, and photo, view-only.
- **GPS plays a supporting role only.** The learner chose to keep it after hearing it can't tell floors or bays underground. It records a rough position, and the photo match decides the location.
- **The user always confirms the AI's guess (✓).** The AI never silently decides.
- **Fix wrong guesses by recognising photos, not by reading a map.** The learner finds recognising their spot quicker. If the photos don't help, the next step is a sign-board photo (learner's idea).
- **Step-by-step directions with Next, not a live blue dot.** Real-time tracking was cut in scope. The learner wanted each step to show the choice visually ("3 lifts and showing me which to choose").
- **"Find my car" starts with snapping where you are.** It uses the same matching as parking.
- **Arrived ends the parking. Help re-locates you.** These were the learner's two end-of-trip actions.
- **Dark, futuristic AR / game look.**

## What We're Building
- Home screen with Capture, the Current Parking card, and Parking History.
- One-photo parking capture → AI location match (reference photos + sign text) → confirm.
- Fix flow: other guesses → sign photo → pick from list.
- Room-number destination → shortest-route steps with highlighted pictures and Next.
- Find my car → snap where you are → shortest route back → Arrived.
- Help on direction steps to re-locate.
- Supporting GPS stamp on captures.
- A hand-entered map of the dorm demo path and ~10–20 tagged reference photos (from `scope.md > The POC Boundary`).
- The dark futuristic look.

## Deferred From the POC
- **Live, real-time position (Google Maps-style moving dot):** this needs indoor tracking, which scope cut as too hard and drift-prone.
- **Real camera AR arrows:** a large extra build. The POC only borrows the style.
- **GPS for floor/bay positioning:** GPS is unreliable indoors and underground and can't tell floors.
- **Tapping a history row to re-route or reuse it:** history is view-only for now.
- **More than one building, and more than the single demo path.**

## Possible Later Enhancements
From `scope.md > Later`: paid vision AI if free matching isn't accurate enough, AI-built maps from floor plans, friendly landmark-based directions, phone-sensor tracking, a shared anonymous map that grows from many users' walks, and more building types. New ideas from this interview: real AR arrows over the camera, and live position following.

**Product vision (learner, during the build): Wayback for any building.** Anyone can upload a building's 2D diagram (a mall, a theme park, a campus), set its scale, and draw the walkable paths, lifts, stairs and entrances on it. Surveyors then walk the site with Survey mode, pinning spots with GPS, four-side photos and notes. The app builds its photo-matching data and a 3D view from that, and visitors navigate it the same way M06 works today. Already proved in the POC: survey capture, GPS anchoring, free on-device photo matching, shortest routes and the 3D view. Still needed: a diagram upload and map editor, per-building data in the cloud instead of in the app's files, matching data built straight from surveys, and 3D extruded from drawn outlines. Outdoor sites like theme parks would lean more on GPS; indoor malls on photos and floor confirmation, like M06.

## Non-Goals
- **No GPS-based indoor guidance:** it doesn't work reliably indoors (`scope.md > Explicitly Cut`).
- **No Wi-Fi/Bluetooth beacons or QR stickers:** these need equipment in the building.
- **No asking users to photograph landmarks along the way:** the learner said it "really waste time". Photos are taken only at parking, at "Find my car", and when asking for Help.
- **No paid AI APIs:** "free for now" (`scope.md > The POC Boundary`).
- **No accounts or sharing.**

## Open Questions
- **Capturing while a car is already parked:** does the old parking move to history automatically, or does the app ask first? This can be decided in `4-spec` / build, so it isn't blocking.
- **Glow colours:** the learner hasn't chosen any. `4-spec` can propose them, so it isn't blocking.
- **Photo vs. a few frames:** scope assumed one photo, and this PRD uses one photo per capture. Confirm whether that's right. It isn't blocking.
