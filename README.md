# Wayback

Snap your parking spot, and Wayback walks you to your room and back to your car, inside a building where GPS can't see.

Built for **Build With AI: Basics** (Devpost). The demo building is Block M06, Desasiswa Tekun, USM.

- **Demo video:** https://youtu.be/RzueeV50nw4
- **Live app:** https://wayback-m06-1626.web.app (open it on a phone; it only gives real results at M06)

## What's in this repo

| Folder | What it holds |
|---|---|
| [`wayback/`](wayback/) | The app (Next.js, three.js, CLIP and PaddleOCR in the browser, Firebase). Setup, commands and deploy steps are in [`wayback/README.md`](wayback/README.md). |
| [`devpost/`](devpost/) | The planning documents written before and during the build: [scope](devpost/scope.md), [PRD](devpost/prd.md), [technical spec](devpost/spec.md), [build checklist](devpost/checklist.md), and the [app map](devpost/app-map.html). |

## Quick start

```bash
cd wayback
npm install
npm run dev
```

Create `wayback/.env.local` with your Firebase web app config first. The variable names are listed in [`wayback/README.md`](wayback/README.md#run-it-locally).
