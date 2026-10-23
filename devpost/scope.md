---
doc: scope
status: approved
---

# Wayback (working name)

A phone app that gets you to the right room — and back to your parked car — by the shortest walking route, inside buildings where GPS can't see.

## The Unique Kernel
**Snap your parking spot → AI matches it against reference photos of the building to pin the car on the map → shortest walking route there and back.** No GPS, no mall beacons, no constant photo-taking. Because the app knows the building's structure (floors, wings, lifts, stairs), it can give a true shortest route — not just "the way you came."

## Who It's For
Someone new to a large multi-floor building with a car park — like the learner's family at a Kuala Lumpur mall, or a new resident or visitor at the learner's dorm (4 directions, 4 lifts, each with up and down, many floors).
Today they take a photo of the parking spot, but that only *remembers* the spot — it doesn't get them back to it. They waste time choosing the wrong door, lift, or floor.

## The Core Loop
1. Park → capture the car's surroundings once in the app.
2. Walk inside → the app directs you to your destination (e.g. your room number).
3. Later, open the app and snap where you are → it matches your location and shows the shortest way back to the car.

Effort ceiling (learner's words): "taking the first photo," then the app does the rest; "when back open the app and show the route to the car."

## Inspiration & Identity
Not discussed yet — `3-prd` will ask.

## Why This Matters to the Learner
A real family pain: "when going to shopping mall can't remember where we parked the car, especially in Kuala Lumpur" — and being new to an area with "lots of parking slots and doors" and not knowing which floor. The learner rejected ideas that ChatGPT could already do; this one needs *their* location and *their* building.

## What "Working" Looks Like
Demo filmed in the learner's dorm: park the car and capture the surroundings → walk inside → enter the room number and follow the directions to the room → later, open the app and follow the shortest route back to the car.
The "oh, that's cool" beat: the app reads the parking capture and later lays out a step-by-step shortest route (which direction, which lift, which floor) back to the exact spot.

## The POC Boundary
- **One building: the learner's dorm**, its layout entered by hand as a small map of connections (car park areas, entrances, the 4 lifts and stairs, the floors and rooms needed for the demo).
- **Reference photos of the building:** a one-time setup where the builder photographs the key spots on the demo path (car park zones, lift lobbies, entrances — roughly 10–20 photos), each tagged to its place on the map. Learner: "need a data that capture around the building so will have accurate data" — signs alone may not exist or be readable.
- **AI matches the parking capture** against those reference photos (plus any visible signs) to place the car on the map — a retrieval step, RAG-style, with images. *Assumption: a photo (or a few frames) rather than full video analysis — confirm.*
- **Shortest-route calculation** on the map (plain algorithm, not AI), shown as clear steps: car → room, and room → car.
- **Way back: "where am I?" matching.** The user snaps a photo of where they are; the same matching pins *them* on the map, then the app routes them to the car. Works from anywhere on the demo path, not just the room. Reference photos must cover likely starting spots (room corridor, lift lobbies). Learner: "matching current location to match correctly with the car location... way back also need to match."
- **Must be free for now:** AI photo matching uses a free option (e.g. an open-source model like CLIP running locally or in the browser) — no paid API. Learner: "free for now."
- **Safety net:** if matching isn't confident, show top guesses or let the user tap their spot on the map, so the demo never dead-ends.
- **Small demo path:** one car park level, one or two lifts, one route to the room.

## Later
- Paid vision AI for smarter matching, if the free model isn't accurate enough.
- AI builds the building map from a floor-plan photo or description, so maps don't need hand-entering.
- AI turns the route into friendly, landmark-based directions.
- True background recording with phone sensors (steps, compass, floor changes) — Android possible, iPhone restricted.
- A shared map that grows from many users' walks, learning shortcuts anonymously (ties to the learner's interest in anonymous sharing).
- More buildings: malls, schools, offices, apartments.

## Explicitly Cut
- **GPS-based indoor guidance** — GPS doesn't work reliably indoors or underground.
- **Wi-Fi/Bluetooth beacons** — needs the building's own equipment.
- **Background sensor tracking (for now)** — too hard and drift-prone for 2–4 hours; the building map plus AI vision replaces it.
- **Asking users to photograph landmarks along the way** — learner: "really waste time, not a good solution if always ask user to take photo."
- **The original "adulting mentor" idea** — learner: "not attractive enough, why I don't ask GPT."
