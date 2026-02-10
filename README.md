# Boxing Cardio Bookings

A PWA for managing boxing cardio class bookings. Coaches manage schedules, members book sessions.

## Tech Stack

- React 18 + TypeScript + Vite
- Firebase (Auth, Firestore, Hosting, Cloud Messaging, Cloud Functions)
- Tailwind CSS
- PWA with offline support

## Setup

1. **Install dependencies**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password + Google)
   - Create a Firestore database
   - Copy `.env.example` to `.env` and fill in your Firebase config values
   - Update `public/firebase-messaging-sw.js` with your Firebase config
   - Update `.firebaserc` with your project ID

3. **FCM / VAPID Key**
   - In Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
   - Generate a key pair and add the VAPID key to `VITE_FIREBASE_VAPID_KEY` in `.env`

4. **Run locally**
   ```bash
   npm run dev
   ```

5. **Deploy Cloud Functions** (requires Blaze plan)
   ```bash
   cd functions && npm run build && cd ..
   firebase deploy --only functions
   ```

6. **Deploy Hosting**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## How It Works

- **First user** to register becomes the **coach**. Subsequent users are **members**.
- Coach creates recurring time slots at `/coach/slots`.
- Sessions are auto-generated when viewing the weekly schedule.
- Members book sessions with atomic transactions (prevents overbooking).
- Coach can cancel sessions, manage check-ins, and post announcements.
- Push notifications via FCM for session cancellations, announcements, and daily reminders.

## Firestore Collections

- `users` — User profiles with roles
- `slots` — Recurring weekly time slots
- `sessions` — Generated sessions with denormalized slot data
- `bookings` — User bookings with deterministic IDs
- `announcements` — Current announcement
- `notifications` — In-app notifications
