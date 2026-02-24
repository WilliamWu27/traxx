# TRAX - Habit Competition Tracker

Compete with friends on habits. Earn crystals, set stakes, win together.

## Current Version: Browser Storage

The app currently uses browser storage (temporary). This works great for testing but data can be lost.

## Upgrading to Firebase (Recommended)

Firebase gives you:
- ✅ Permanent cloud storage
- ✅ Real authentication
- ✅ Multi-device sync
- ✅ Never lose data

### Quick Start

1. **Set up Firebase** (see FIREBASE_SETUP.md)
2. **Add your config** to `src/firebase.js`
3. **Deploy** to Vercel

### Migration Options

**Option 1: Test with Browser Storage First** (Recommended)
- Deploy current version
- Test with friends for 1-2 weeks
- Then migrate to Firebase

**Option 2: Go Straight to Firebase**
- Complete Firebase setup first
- Then deploy

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deployment

Push to GitHub → Vercel auto-deploys

## Features

- 🏆 Crystal-based competition
- 💎 Mind, Body, Spirit categories
- 🎯 Weekly stakes tracking
- 📊 Custom or shared habits
- ⏰ Countdown timers
- 📱 Mobile-friendly

## Tech Stack

- React 18
- Vite
- Firebase (optional)
- Tailwind CSS
- Lucide Icons
