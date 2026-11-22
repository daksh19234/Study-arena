# Study Arena — Live public leaderboard + PWA

A mobile-first study dashboard for a small group of friends. It includes a public global leaderboard, username handles, daily study-session logging, XP, streaks, subject analytics, a chapter checklist, local history export, and PWA install/offline app-shell support.

## Important launch facts

- **Live sharing is Firebase-backed.** The project is supplied as a ready-to-configure app, but it is not connected to a Firebase project or deployed yet. Live friends/leaderboard sync starts after you add your own Firebase web config and deploy it.
- **Public means public.** Anyone with the site URL can see leaderboard usernames and aggregate stats (XP, hours, streak, chapter count). Detailed daily logs are owner-only in Firestore rules.
- Use a nickname, not a real full name. Do not enter your school, phone number, address, location, email, or other identifying information. This starter app has no direct messages or comments.
- XP and study totals are self-reported by the app client. This starter architecture is for friendly accountability, not a fraud-proof competition.
- Anonymous sign-in creates a device/browser identity. Clearing browser data or moving to another device can lose access to that anonymous profile. A permanent sign-in/linking flow is not included in this first version.

## Project structure

```text
study-arena-pwa/
  public/
    index.html
    styles.css
    app.js
    firebase-config.js
    manifest.webmanifest
    sw.js
    icons/
  firebase.json
  firestore.rules
  firestore.indexes.json
  README.md
```

## 1) Create and configure Firebase

1. Create a Firebase project in the Firebase console.
2. Add a **Web app** to the project.
3. In **Authentication → Sign-in method**, enable **Anonymous** sign-in.
4. In **Firestore Database**, create a database. Start in production/locked mode.
5. Open **Project settings → Your apps → SDK setup and configuration** and copy the web config values.
6. Open `public/firebase-config.js` and replace `YOUR_API_KEY`, `YOUR_PROJECT_ID`, and `YOUR_APP_ID` with the values from the Firebase web app. Keep the config file public; never put a service-account private key in browser code.

The app uses Firebase's modular browser SDK via official gstatic CDN browser modules. A browser must have internet access for authentication and live Firestore updates.

## 2) Deploy Firestore rules and indexes

Install Firebase CLI on a computer with Node.js, then in this project folder run:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Choose the Firebase project you just created. Then deploy the database rules/indexes and web app:

```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

The included rules make profile aggregates readable to everyone for the public leaderboard, restrict profile writes to their owner, make usernames unique, and keep detailed daily logs private to their owner.

## 3) Share with friends

After deploy, Firebase Hosting prints a URL similar to `https://YOUR-PROJECT-ID.web.app`.

1. Open that URL on your phone.
2. Claim a unique nickname (3–18 lowercase letters, numbers, or underscores).
3. Use **Invite friends** to share the same URL.
4. Friends open the same URL and choose their own nicknames.
5. Once signed in, the leaderboard updates live for all open clients as profile stats change.

## 4) Install as a PWA on Android

1. Open the deployed HTTPS URL in Chrome.
2. Use the in-app **Install** control when it appears, or Chrome menu → **Install app / Add to Home screen**.
3. Launch Study Arena from the home screen.

The service worker caches the app shell for faster repeat loads and basic offline display. Live updates, authentication and new writes require connectivity. Firebase Hosting provides HTTPS, which is required for service workers/PWA installability.

## How scoring works

- 1 XP for every 15 logged study minutes.
- 5 XP per practice task marked completed.
- 20 XP per chapter marked complete in a session log.
- A session can be replaced/edited for the same date and session slot; profile totals are adjusted by the difference, avoiding duplicate accumulation on edits.
- Daily target: 240 minutes (4 hours). Two slots: Session 1 and Session 2, each up to 240 minutes in this starter build.
- Weekly goal: 1,680 minutes (28 hours).

## Data model

- `profiles/{uid}` — public aggregate profile and completed chapter IDs.
- `usernames/{username}` — public username registry to prevent duplicate handles.
- `dailyLogs/{uid_yyyy-mm-dd}` — private owner-only day summary with two session slots.

## Known limits / next production hardening

- The public leaderboard is global (all users of this Firebase project), not a private invite-only group.
- Stats are self-reported and client-calculated. For stronger anti-cheat, move XP calculation and aggregate updates into trusted Cloud Functions and add App Check / rate limiting.
- Add a permanent sign-in/linking method before relying on cross-device account recovery.
- The class 9 chapter checklist is an editable starter outline and must be checked against the latest school-issued final-exam syllabus.
- This package does not create a Firebase project, configure DNS, or publish the hosting URL on your behalf; those steps require your Firebase account and project.
