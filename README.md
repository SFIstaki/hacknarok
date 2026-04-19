# Presently

LIVE DEMO: https://youtu.be/AC_CxWFuqCA

Presently is a desktop application created by Team SFIstaki during **Hacknarok 2026** in the programming (general) category.

Presently improves your attention in everyday work and study routines. 🍃

It was the answer to the following Hackathon theme:

🇵🇱 _Dekada innowacji: zbuduj fundamenty nowej ery w otaczającej nas rzeczywistości._

🇬🇧 _A decade of innovation: build the foundations of a new era in the reality that surrounds us._

### Why is Presently effective?

The app gives users a simple, visual way to understand focus states, review trends, and get practical tips to stay _present_. It does so through estimating head pose, a proxy used to measure user focus on the screen. 

### Why we built It

Attention is one of the most valuable skills in today's noisy, digital world.
Our goal was to design a tool that is approachable, friendly, and motivating, while still providing the user with meaningful focus insights.

We care most about helping younger generations do what they love doing, one thing at a time.

## Features

- Onboarding flow focused on personalization 
- Attention state overview: _**locked in**, fading, <u>gone</u>._
- Focus timeline and progress visualizations
- Tips view with friendly mascot guidance (SFIstak / marmot)
- Statistics screen for trend insights 
- Settings and mode explanations (focus/relax)
- English-Polish language toggle
- Light & Dark mode

## Architecture Overview

Presently is built as an Electron desktop app with a clear split between frontend and backend responsibilities:

- Frontend side (Renderer): React UI where users interact with the app
- Backend side (Desktop core): Electron main process and preload layer that manage the native app window and secure bridge
- Cloud storage side: Supabase bucket used to store user preferences

The backend combines local Electron runtime capabilities with Supabase storage for persisted user preference data.

## Tech Stack

### Frontend

- React 19
- TypeScript 5
- Vite 7 (via electron-vite)
- CSS (custom styles)
- Simple in-app i18n (EN/PL)

### Backend/Desktop Core

- Electron 39 (main process)
- Electron preload script with contextBridge
- Node.js runtime inside Electron
- @electron-toolkit/utils and @electron-toolkit/preload
- Supabase bucket (user preferences storage)

### Build and Tooling

- electron-vite
- electron-builder
- ESLint 9
- Prettier 3

## Getting Started

### Install dependencies

```bash
$ npm install
```

### Run in development mode

```bash
$ npm run dev
```

Beware, to run app yourself properly, you may need to create an .env.local file with
```
VITE_SUPABASE_URL=https://tsjhqkgkbjwazyafaprc.supabase.co/
VITE_SUPABASE_ANON_KEY=<key>
```

### Build installers/packages

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Project Structure

```text
src/
	main/       # Electron main process (desktop runtime)
	preload/    # Secure bridge between main and renderer
	renderer/   # React frontend app
```

### Note :)

_Built with ❤️ by Team SFIstaki at Hacknarok 2026._
