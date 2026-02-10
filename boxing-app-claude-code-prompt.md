# Boxing Cardio Booking App — Claude Code Prompt

Use the prompts below in order. Complete each phase, review the output, then move to the next.

---

## Phase 1: Project Setup & Auth

```
Create a React + Vite + TypeScript web app for a boxing cardio coach to manage class bookings.

## Tech Stack
- React 18+ with Vite and TypeScript
- Firebase (Auth, Firestore, Hosting, Cloud Messaging)
- Tailwind CSS for styling (no other UI library)
- vite-plugin-pwa for PWA support
- React Router v6 for routing

## Project Setup
- Initialize with: npm create vite@latest boxing-bookings -- --template react-ts
- Install dependencies: firebase, react-router-dom, vite-plugin-pwa, tailwindcss
- Configure Tailwind
- Configure PWA plugin in vite.config.ts with:
  - App name: "Boxing Cardio"
  - Short name: "BoxFit"
  - Theme color: #dc2626 (red-600)
  - Register service worker for offline caching of app shell
  - Generate a simple manifest with appropriate boxing/fitness icons (use placeholder SVG icons for now)
- Set up a clean folder structure:
  src/
    components/     (shared UI components)
    pages/          (route-level page components)
    hooks/          (custom React hooks)
    context/        (React context providers)
    lib/            (firebase config, utility functions)
    types/          (TypeScript interfaces/types)

## Firebase Configuration
- Create src/lib/firebase.ts with Firebase config using environment variables (VITE_FIREBASE_*)
- Initialize Auth, Firestore, and Messaging (FCM)
- For Messaging: initialize only if the browser supports it (check 'Notification' in window)
- DO NOT hardcode any Firebase credentials — use .env.example with placeholder values
- Also add VITE_FIREBASE_VAPID_KEY to env for push notifications

## TypeScript Types (src/types/index.ts)
Define these interfaces:

interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'member' | 'coach';
  fcmTokens: string[];       // array of FCM tokens (user may have multiple devices)
  notificationsEnabled: boolean;
  createdAt: Timestamp;
}

interface Slot {
  id: string;
  dayOfWeek: number;        // 0=Sunday, 1=Monday, etc.
  startTime: string;        // "18:00" (24h format)
  endTime: string;          // "19:00"
  location: string;
  maxCapacity: number;
  isActive: boolean;
  coachId: string;
}

interface Session {
  id: string;
  slotId: string;
  date: string;             // "2025-02-15" ISO date string
  status: 'scheduled' | 'cancelled';
  note?: string;            // optional coach note/announcement
}

interface Booking {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;         // denormalized for coach's quick view
  bookedAt: Timestamp;
  checkedIn: boolean;
  status: 'confirmed' | 'cancelled';
}

interface Notification {
  id: string;
  userId: string;           // recipient ('all' for broadcast)
  type: 'session_cancelled' | 'announcement' | 'booking_reminder' | 'spot_available';
  title: string;
  message: string;
  relatedSessionId?: string;
  read: boolean;
  createdAt: Timestamp;
}

interface Announcement {
  id: string;               // always 'current'
  message: string;
  createdAt: Timestamp;
  coachId: string;
}

## Auth Context (src/context/AuthContext.tsx)
- Create AuthProvider using Firebase Auth with onAuthStateChanged listener
- Support Google sign-in and Email/Password sign-in
- On first sign-in, create a User document in Firestore "users" collection with role: "member", notificationsEnabled: false, fcmTokens: []
- Provide a useAuth() hook that returns: { user, userData (Firestore user doc), loading, signIn, signInWithGoogle, signUp, signOut }
- The FIRST user to sign up should be automatically assigned role: "coach" (simple bootstrap — no admin setup needed). All subsequent users get "member".

## Auth Pages
- /login page with:
  - Email + password sign in form
  - "Sign in with Google" button
  - Link to /register for new users
  - Clean, mobile-first design
- /register page with:
  - Name, email, password form
  - Link back to /login
- Both pages should redirect to / if already authenticated

## Protected Routes
- Create a ProtectedRoute component that redirects to /login if not authenticated
- Create a CoachRoute component that additionally checks role === 'coach'

## App Routing (src/App.tsx)
- /login — LoginPage
- /register — RegisterPage
- / — Dashboard (protected, shows different view based on role)
- /schedule — WeeklySchedule (protected, member booking view)
- /my-bookings — MyBookings (protected, member's upcoming bookings)
- /coach — CoachDashboard (coach-only)
- /coach/slots — ManageSlots (coach-only)

## Shared Layout
- Create a Layout component with:
  - Top navbar with app name "Boxing Cardio" and user menu (name + sign out)
  - A notification bell icon in the top navbar with unread badge count
  - Bottom mobile navigation bar with icons for: Schedule, My Bookings, (and Coach Dashboard if coach)
  - The layout should feel like a mobile app

## Styling Direction
- Mobile-first, designed primarily for phones
- Bold, energetic feel — use red (red-600) as primary color with dark grays/black
- Rounded cards with subtle shadows
- Large tap targets for buttons (min 44px)
- Clean typography, nothing fancy

Build this phase completely. Make sure the app runs with npm run dev, Firebase Auth works, and navigation between routes functions correctly. Use placeholder content on pages we'll build in Phase 2.
```

---

## Phase 2: Member Experience (Schedule & Booking)

```
Continue building the boxing cardio booking app. Build the member-facing features.

## Weekly Schedule Page (/schedule)
This is the main page members see. Show the current week's sessions.

- At the top, show the announcement banner if one exists (query announcements/current doc)
  - Styled as a colored banner (yellow/amber background) with the coach's message
  - Dismissible per session (not permanently — shows again next visit)
- Display a week view starting from Monday
- Show each day that has a session as a card with:
  - Day name and date (e.g., "Tuesday, Feb 18")
  - Time (e.g., "18:00 - 19:00")
  - Location
  - Spots taken vs capacity (e.g., "7 / 15 spots")
  - Visual progress bar showing how full the session is
  - A "Book" button if there's space and user hasn't booked
  - A "Cancel Booking" button if user has already booked this session
  - "Full" badge if at capacity
  - "Cancelled" visual state if coach cancelled the session, showing the coach's note if provided
- Add week navigation arrows to go to next/previous weeks
- Sessions should be auto-generated from the Slots collection:
  - Create a utility function generateSessionsForWeek(slots, weekStartDate) that checks if Session documents exist for each slot for that week, and creates them if they don't exist
  - This should run when the schedule page loads for a given week
  - Only generate sessions for active slots

## Booking Logic (src/hooks/useBooking.ts)
Create a custom hook with:
- bookSession(sessionId): creates a Booking document with status 'confirmed', checkedIn: false. Should check capacity before booking (read current booking count, reject if full). Use a Firestore transaction to prevent overbooking.
- cancelBooking(bookingId): updates booking status to 'cancelled'
- getUserBookingsForWeek(weekStart): returns user's bookings for the displayed week
- getBookingCountForSession(sessionId): returns count of confirmed bookings

## My Bookings Page (/my-bookings)
- Show list of user's upcoming confirmed bookings (today and forward)
- Each booking card shows: day, date, time, location
- Cancel button on each booking
- If the session was cancelled by coach, show it with a "Cancelled by coach" badge and the note
- Empty state: "No upcoming bookings. Check the schedule to book a session!" with a link to /schedule
- Sort by date ascending (soonest first)

## Session Auto-Generation Logic
When the schedule page loads for a given week:
1. Query existing Sessions for that week's date range
2. For each active Slot, check if a Session exists for its day in that week
3. If not, create the Session document with status: 'scheduled'
4. This means sessions are created on-demand as people view the schedule

## Firestore Queries to Implement
- Get all active slots: query slots collection where isActive == true
- Get sessions for a date range: query sessions collection by date range
- Get bookings for a session: query bookings where sessionId == X and status == 'confirmed'
- Get user's bookings: query bookings where userId == X and status == 'confirmed'

## Important UX Details
- Show a loading skeleton while data loads
- Show toast/notification on successful booking or cancellation
- Disable the Book button and show a spinner while the booking transaction is processing
- If a booking fails (full), show a clear error message
- The schedule should feel snappy — avoid full page reloads

Build this phase completely. The member flow should work end-to-end: view schedule → book a session → see it in My Bookings → cancel if needed.
```

---

## Phase 3: Coach Dashboard & Slot Management

```
Continue building the boxing cardio booking app. Build the coach-facing features.

## Coach Dashboard (/coach)
The coach's home screen. At-a-glance view of the current week.

- Show a summary card for each session this week:
  - Day, date, time
  - Number of confirmed bookings / max capacity
  - Color-coded: green (< 50% full), yellow (50-80%), red (> 80%)
  - Tap/click to expand and see the attendee list
- Attendee list for each session shows:
  - Member name and email
  - A simple check-in toggle (checkbox) the coach can use at the gym
  - Check-in state is stored in the Booking document (checkedIn field)
- Quick action: "Cancel Session" button on each session card
  - When cancelled, update session status to 'cancelled'
  - Show a modal/form where coach can add a note explaining the cancellation
  - All confirmed bookings for that session should remain (they'll see it as cancelled in their view)
  - Create in-app Notification documents for all users who had bookings for this session (type: 'session_cancelled')
- Week navigation (same as member schedule)

## Announcements
- Section on coach dashboard to manage announcements
- Text input with a "Post Announcement" button
- Store in Firestore: announcements/current with fields: message, createdAt, coachId
- "Clear Announcement" button to remove it
- When posting an announcement, create in-app Notification documents for all members (type: 'announcement')
- Members see the announcement as a colored banner at the top of the /schedule page
- Keep it simple — one active announcement at a time

## Manage Slots (/coach/slots)
Where the coach configures the recurring weekly schedule.

- Show current slots as a list of cards, organized by day of week
- Each slot card shows: day, time, location, capacity, active/inactive status
- "Add Slot" button opens a form/modal with:
  - Day of week dropdown (Monday - Sunday)
  - Start time picker
  - End time picker
  - Location text input
  - Max capacity number input
  - Save button
- Edit slot: tap existing slot to edit same fields
- Deactivate slot: toggle to mark slot as inactive (don't delete — keeps history)
  - Inactive slots should not generate new sessions
  - Existing sessions from inactive slots remain visible but marked

## Firestore Security Rules
Generate a firestore.rules file with these rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: can read own doc, coach can read all
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isCoach());
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && (request.auth.uid == userId || isCoach());
    }

    // Slots: anyone authenticated can read, only coach can write
    match /slots/{slotId} {
      allow read: if request.auth != null;
      allow write: if isCoach();
    }

    // Sessions: anyone authenticated can read and create (for auto-generation), coach can update
    match /sessions/{sessionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if isCoach();
    }

    // Bookings: authenticated can read, can create own, can update own or coach can update
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null &&
        (resource.data.userId == request.auth.uid || isCoach());
    }

    // Announcements: anyone authenticated can read, coach can write
    match /announcements/{announcementId} {
      allow read: if request.auth != null;
      allow write: if isCoach();
    }

    // Notifications: users can read and update (mark read) their own, coach can create for anyone
    match /notifications/{notificationId} {
      allow read: if request.auth != null &&
        (resource.data.userId == request.auth.uid || resource.data.userId == 'all');
      allow create: if isCoach();
      allow update: if request.auth != null &&
        (resource.data.userId == request.auth.uid || resource.data.userId == 'all');
    }

    function isCoach() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'coach';
    }
  }
}

## Firebase Hosting + Deployment Config
- Create firebase.json for hosting configuration:
  - Public directory: dist
  - SPA rewrites (all routes to index.html)
  - Cache headers for static assets
- Create .firebaserc with a placeholder project ID

Build this phase completely. The coach should be able to: manage weekly slots, view the dashboard with attendee lists, check people in, cancel sessions (which creates notifications), and post announcements.
```

---

## Phase 4: Notifications System

```
Continue building the boxing cardio booking app. Build the complete notification system — both in-app and push notifications.

## In-App Notifications

### Notification Bell (already in Layout from Phase 1)
- The bell icon in the top navbar should show an unread count badge (red circle with number)
- Tapping the bell opens a notification dropdown/panel:
  - List of recent notifications (last 20), newest first
  - Each notification shows: icon by type, title, message, time ago (e.g., "2 hours ago")
  - Unread notifications have a subtle highlight/background
  - Tapping a notification marks it as read
  - If notification has a relatedSessionId, tapping navigates to the schedule
  - "Mark all as read" button at the top
- On mobile, the notification panel should be a full-screen overlay, not a small dropdown

### Notification Hook (src/hooks/useNotifications.ts)
- useNotifications() hook that:
  - Subscribes to real-time notifications for the current user (where userId == currentUser.uid OR userId == 'all')
  - Returns: { notifications, unreadCount, markAsRead, markAllAsRead }
  - Uses onSnapshot for real-time updates so the badge updates instantly
  - Orders by createdAt descending

### When Notifications Are Created (in-app)
These are Firestore documents created in the "notifications" collection:

1. **Session cancelled by coach** (already implemented in Phase 3):
   - Create one notification per user who had a confirmed booking
   - type: 'session_cancelled'
   - title: "Session Cancelled"
   - message: "The {dayOfWeek} {time} session on {date} has been cancelled. {coach's note if provided}"

2. **New announcement posted**:
   - Create a single notification with userId: 'all' (broadcast)
   - type: 'announcement'
   - title: "New Announcement"
   - message: the announcement text

3. **Spot available** (bonus — when someone cancels a booking and the session was previously full):
   - Only trigger if the session was at capacity before the cancellation
   - Create notifications with userId: 'all' (or could be smarter later with waitlist)
   - type: 'spot_available'
   - title: "Spot Available!"
   - message: "A spot opened up for {dayOfWeek} {date} at {time}"

## Web Push Notifications (Firebase Cloud Messaging)

### FCM Setup in the Client
- Create src/lib/messaging.ts:
  - Initialize Firebase Messaging
  - requestNotificationPermission() function that:
    1. Requests browser notification permission
    2. Gets the FCM token using getToken() with the VAPID key
    3. Saves the token to the user's Firestore document (add to fcmTokens array)
    4. Sets notificationsEnabled: true on the user doc
  - onMessageListener() for foreground messages (show a toast when push arrives while app is open)

### Push Notification Permission Flow
- After first login, show a friendly prompt (not the browser's native one immediately):
  - A card/banner that says: "Want to get notified about session changes and reminders?"
  - "Enable Notifications" button and "Maybe Later" dismiss button
  - If they click Enable, THEN trigger the browser permission request
  - Store the user's choice — don't re-prompt if they dismissed
  - Add a toggle in a simple settings/profile section to enable/disable later

### Firebase Cloud Function for Sending Push (functions/src/index.ts)
Create a Firebase Cloud Functions project (functions/ directory) with these triggers:

1. **onSessionCancelled** — Firestore trigger on sessions/{sessionId} update:
   - When status changes to 'cancelled'
   - Query all confirmed bookings for this session
   - Get FCM tokens for those users (from their user docs)
   - Send push notification: "Session Cancelled — {day} {time} session has been cancelled"

2. **onAnnouncementCreated** — Firestore trigger on announcements/current write:
   - Get FCM tokens for ALL users with notificationsEnabled: true
   - Send push notification with the announcement message

3. **onBookingReminder** — Scheduled function (Firebase Scheduled Functions / Cloud Scheduler):
   - Runs daily at a configurable time (e.g., 8:00 AM)
   - Find all sessions happening today
   - Find all confirmed bookings for those sessions
   - Send a push reminder: "Don't forget! Boxing Cardio today at {time}"
   - Also create in-app notification documents (type: 'booking_reminder')

### Cloud Functions Setup
- Initialize in functions/ directory with: npm init in a subfolder
- Use TypeScript
- Dependencies: firebase-admin, firebase-functions
- Create a minimal package.json and tsconfig for the functions directory
- Add deployment instructions to README

### Service Worker for Push (public/firebase-messaging-sw.js)
- This service worker handles background push notifications (when app is not open)
- Import Firebase Messaging scripts
- Handle the onBackgroundMessage event
- Show a system notification with the title, body, and an action to open the app
- Make sure this does NOT conflict with the PWA service worker from vite-plugin-pwa:
  - The PWA service worker handles caching/offline
  - The FCM service worker handles push notifications
  - They can coexist — configure vite-plugin-pwa to NOT override the FCM service worker

Build this phase completely. The notification system should work end-to-end:
- In-app: bell icon with badge → notification panel → mark as read
- Push: permission flow → FCM token stored → cloud functions send push on events → notification appears on phone
- The cloud functions should be ready to deploy with "firebase deploy --only functions"
```

---

## Phase 5: Polish, PWA & Deploy Prep

```
Continue building the boxing cardio booking app. Final polish and PWA optimization.

## PWA Enhancements
- Generate proper app icons (create simple SVG-based icons at required sizes: 192x192, 512x512)
  - Design: a simple boxing glove or fist silhouette in red (#dc2626) on white, or just the letter "B" in a bold font with red background
- Configure the web app manifest properly:
  - name: "Boxing Cardio Bookings"
  - short_name: "BoxFit"
  - theme_color: #dc2626
  - background_color: #ffffff
  - display: standalone
  - start_url: /
  - Icons at 192 and 512
- Service worker should cache the app shell for offline access
- Add an install prompt component that shows "Add to Home Screen" suggestion on first visit (store dismissal in localStorage)
- Ensure the app works offline for viewing cached schedule (booking still requires network)
- Make sure the PWA service worker and FCM service worker coexist properly

## UI Polish
- Add smooth transitions between pages
- Loading skeletons on all data-loading states (not just spinners)
- Empty states with friendly messages and CTAs on all list pages
- Proper error boundary component that catches React errors gracefully
- Make sure all interactive elements have proper hover/active/focus states
- Ensure proper contrast ratios for accessibility
- Add a simple "pull to refresh" visual cue on the schedule page

## Toast Notification System
- Create a simple toast/snackbar component (don't install a library)
- Show toasts for: successful booking, booking cancelled, session cancelled by coach, errors
- Also show a toast when a push notification arrives while the app is in the foreground
- Auto-dismiss after 3 seconds
- Position at bottom of screen above the nav bar

## Simple Settings/Profile Section
- Accessible from the user menu in the top navbar
- Shows: user name, email
- Toggle for push notifications (enable/disable)
  - When enabling: triggers the permission flow
  - When disabling: removes FCM token from user doc, sets notificationsEnabled: false
- Nothing else — keep it minimal

## Responsive Design Check
- Primary: mobile (375px - 428px width)
- Secondary: tablet (768px)
- Tertiary: desktop (1024px+) — just make sure it doesn't look broken, centered content with max-width
- The bottom nav bar should only show on mobile; desktop can use the top navbar

## Final Cleanup
- Make sure there are no TypeScript errors
- Make sure there are no console warnings in development
- Remove any placeholder/dummy content
- Add a proper README.md with:
  - Project description
  - Setup instructions (clone, npm install, configure .env, firebase setup)
  - How to set up Firebase Cloud Messaging (generate VAPID key, add to .env)
  - How to deploy functions: cd functions && npm install && firebase deploy --only functions
  - How to deploy hosting: npm run build && firebase deploy --only hosting
  - How the first user becomes the coach
  - Note about upgrading to Blaze plan for Cloud Functions (still free within limits)
- Create .env.example with all required Firebase config variables including VAPID key
- Make sure npm run build succeeds without errors

Do a final review of the entire codebase. Fix any bugs, type errors, or UX issues you find.
```

---

## Notes for You (not part of the prompts)

### Before starting Phase 1:

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication → Google and Email/Password providers
3. Create a Firestore database (start in test mode, we'll add rules in Phase 3)
4. Get your Firebase config from Project Settings → Web App
5. Have your config values ready to put in `.env`

### Before Phase 4 (Notifications):

1. **Upgrade to Blaze plan** in Firebase console (required for Cloud Functions)
   - This is pay-as-you-go but has a generous free tier
   - Set a budget alert at $1 so you'll know if you somehow exceed free limits (you won't)
   - For this app's scale, the cost will be $0/month
2. **Generate a VAPID key** for FCM:
   - Firebase Console → Project Settings → Cloud Messaging tab
   - Under "Web configuration", click "Generate key pair"
   - Copy the key to your .env as VITE_FIREBASE_VAPID_KEY
3. **Install Firebase CLI** if not already: npm install -g firebase-tools
4. **Initialize Functions**: firebase init functions (select TypeScript)

### Between phases:

- Run the app after each phase and test the flow
- If something's broken, tell Claude Code what's wrong and ask it to fix it
- Don't move to the next phase until the current one works

### After all phases:

1. Deploy functions: `cd functions && npm install && firebase deploy --only functions`
2. Deploy hosting: `npm run build && firebase deploy --only hosting`
3. Deploy rules: `firebase deploy --only firestore:rules`
4. Sign up as the first user (you become the coach)
5. Set up the 5 weekly slots from the coach panel
6. Share the URL with your friend and walk him through the coach features
7. Then have him sign in — he'll be a member, you can change his role to "coach" in Firestore console and change yours to "member" (or keep both as coach)

### Cost Breakdown: $0/month

- Firebase Spark/Blaze free tier covers everything:
  - Auth: 50K monthly active users (free)
  - Firestore: 50K reads, 20K writes per day (free)
  - Hosting: 10GB transfer/month (free)
  - Cloud Functions: 2M invocations/month (free)
  - Cloud Messaging (FCM): completely free, no limits
- Optional: ~$10-12/year for a custom domain

### Push Notification Limitations to Know:

- iOS Safari: Push notifications work on iOS 16.4+ but ONLY if the PWA is installed to the home screen (not in regular Safari browser). Make sure the install prompt is prominent.
- Android Chrome: Works great, both in browser and installed PWA
- Desktop: Works in Chrome, Edge, Firefox
- If a user denies the browser permission prompt, you can't re-ask. They'd need to manually enable it in browser settings. That's why the app shows a friendly pre-prompt first before triggering the actual browser dialog.
