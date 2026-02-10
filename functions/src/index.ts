import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as webpush from "web-push";

admin.initializeApp();
const db = admin.firestore();

const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");
const VAPID_PUBLIC_KEY =
  "BLHeT0sFe02Vv-_7zpg7UVU2B896LYWb9UpaJpvQ-jVrRnlSbhuxTSlkClYIO_AIa8N33KjzmlrkFcbb-ConpEE";

interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let webPushInitialized = false;
function initWebPush() {
  if (webPushInitialized) return;
  webpush.setVapidDetails(
    "mailto:admin@kamenko.web.app",
    VAPID_PUBLIC_KEY,
    vapidPrivateKey.value()
  );
  webPushInitialized = true;
}

async function sendPush(
  subscriptions: PushSub[],
  title: string,
  body: string,
  userSubMap?: Map<string, PushSub[]>
) {
  if (subscriptions.length === 0) return;

  initWebPush();

  const payload = JSON.stringify({ title, body, url: "/schedule" });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      )
    )
  );

  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`Push sent: ${success} success, ${failed} failure`);

  // Clean up stale subscriptions (410 Gone or 404 Not Found)
  if (userSubMap) {
    const staleEndpoints = new Set<string>();
    results.forEach((result, index) => {
      if (
        result.status === "rejected" &&
        result.reason?.statusCode &&
        (result.reason.statusCode === 410 || result.reason.statusCode === 404)
      ) {
        staleEndpoints.add(subscriptions[index].endpoint);
      }
    });

    if (staleEndpoints.size > 0) {
      console.log(`Removing ${staleEndpoints.size} stale push subscriptions`);
      for (const [userId, userSubs] of userSubMap) {
        const validSubs = userSubs.filter(
          (sub) => !staleEndpoints.has(sub.endpoint)
        );
        if (validSubs.length < userSubs.length) {
          await db.collection("users").doc(userId).update({
            pushSubscriptions: validSubs,
          });
        }
      }
    }
  }
}

// Trigger: When a session status changes to 'cancelled'
export const onSessionCancelled = onDocumentUpdated(
  {
    document: "sessions/{sessionId}",
    secrets: [vapidPrivateKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === "cancelled" || after.status !== "cancelled") return;

    const sessionId = event.params.sessionId;

    const bookingsSnap = await db
      .collection("bookings")
      .where("sessionId", "==", sessionId)
      .where("status", "==", "confirmed")
      .get();

    if (bookingsSnap.empty) return;

    const subscriptions: PushSub[] = [];
    const userSubMap = new Map<string, PushSub[]>();
    for (const bookingDoc of bookingsSnap.docs) {
      const userId = bookingDoc.data().userId;
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.data();
      if (
        userData?.notificationsEnabled &&
        userData?.pushSubscriptions?.length > 0
      ) {
        subscriptions.push(...userData.pushSubscriptions);
        userSubMap.set(userId, userData.pushSubscriptions);
      }
    }

    const startTime = after.startTime || "";
    const date = after.date || "";
    const cancelNote = after.cancelNote ? ` Napomena: ${after.cancelNote}` : "";

    await sendPush(
      subscriptions,
      "Trening otkazan",
      `Trening u ${startTime} dana ${date} je otkazan.${cancelNote}`,
      userSubMap
    );
  }
);

// Trigger: When a new announcement is posted
export const onAnnouncementCreated = onDocumentWritten(
  {
    document: "announcements/current",
    secrets: [vapidPrivateKey],
  },
  async (event) => {
    const after = event.data?.after.data();
    if (!after || !after.message) return;

    const postedByUid = after.postedByUid || "";

    const usersSnap = await db
      .collection("users")
      .where("notificationsEnabled", "==", true)
      .get();

    const subscriptions: PushSub[] = [];
    const userSubMap = new Map<string, PushSub[]>();
    for (const userDoc of usersSnap.docs) {
      if (userDoc.id === postedByUid) continue;
      const userData = userDoc.data();
      if (userData.pushSubscriptions?.length > 0) {
        subscriptions.push(...userData.pushSubscriptions);
        userSubMap.set(userDoc.id, userData.pushSubscriptions);
      }
    }

    await sendPush(subscriptions, "Novo obavještenje", after.message, userSubMap);
  }
);

// Trigger: When a new booking is created, notify the coach
export const onBookingCreated = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    secrets: [vapidPrivateKey],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "confirmed") return;

    const userName = data.userName || "Član";
    const sessionDate = data.sessionDate || "";
    const startTime = data.sessionStartTime || "";

    const coachSnap = await db
      .collection("users")
      .where("role", "==", "coach")
      .get();

    if (coachSnap.empty) return;

    const title = "Nova rezervacija";
    const message = `${userName} je rezervisao trening u ${startTime} dana ${sessionDate}.`;

    for (const coachDoc of coachSnap.docs) {
      const coachData = coachDoc.data();

      await db.collection("notifications").add({
        userId: coachDoc.id,
        type: "booking_confirmed",
        title,
        message,
        read: false,
        relatedSessionId: data.sessionId || "",
        createdAt: new Date().toISOString(),
      });

      if (
        coachData.notificationsEnabled &&
        coachData.pushSubscriptions?.length > 0
      ) {
        const coachSubMap = new Map<string, PushSub[]>();
        coachSubMap.set(coachDoc.id, coachData.pushSubscriptions);
        await sendPush(coachData.pushSubscriptions, title, message, coachSubMap);
      }
    }
  }
);

// Trigger: When a booking is cancelled by a member, notify the coach
export const onBookingCancelled = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    secrets: [vapidPrivateKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === "cancelled" || after.status !== "cancelled") return;

    const userName = after.userName || "Član";
    const sessionDate = after.sessionDate || "";
    const startTime = after.sessionStartTime || "";

    const coachSnap = await db
      .collection("users")
      .where("role", "==", "coach")
      .get();

    if (coachSnap.empty) return;

    const title = "Rezervacija otkazana";
    const message = `${userName} je otkazao trening u ${startTime} dana ${sessionDate}.`;

    for (const coachDoc of coachSnap.docs) {
      const coachData = coachDoc.data();

      await db.collection("notifications").add({
        userId: coachDoc.id,
        type: "booking_cancelled",
        title,
        message,
        read: false,
        relatedSessionId: after.sessionId || "",
        createdAt: new Date().toISOString(),
      });

      if (
        coachData.notificationsEnabled &&
        coachData.pushSubscriptions?.length > 0
      ) {
        const coachSubMap = new Map<string, PushSub[]>();
        coachSubMap.set(coachDoc.id, coachData.pushSubscriptions);
        await sendPush(coachData.pushSubscriptions, title, message, coachSubMap);
      }
    }
  }
);

// Scheduled: Daily booking reminders at 8:00 AM
export const onBookingReminder = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/New_York",
    secrets: [vapidPrivateKey],
  },
  async () => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    const sessionsSnap = await db
      .collection("sessions")
      .where("date", "==", dateStr)
      .where("status", "==", "scheduled")
      .get();

    if (sessionsSnap.empty) return;

    for (const sessionDoc of sessionsSnap.docs) {
      const sessionData = sessionDoc.data();

      const bookingsSnap = await db
        .collection("bookings")
        .where("sessionId", "==", sessionDoc.id)
        .where("status", "==", "confirmed")
        .get();

      for (const bookingDoc of bookingsSnap.docs) {
        const bookingData = bookingDoc.data();
        const userId = bookingData.userId;

        await db.collection("notifications").add({
          userId,
          type: "reminder",
          title: "Trening danas",
          message: `Vaš Boxing Cardio trening u ${sessionData.startTime} je danas!`,
          read: false,
          relatedSessionId: sessionDoc.id,
          createdAt: new Date().toISOString(),
        });

        const userSnap = await db.collection("users").doc(userId).get();
        const userData = userSnap.data();
        if (
          userData?.notificationsEnabled &&
          userData?.pushSubscriptions?.length > 0
        ) {
          const reminderSubMap = new Map<string, PushSub[]>();
          reminderSubMap.set(userId, userData.pushSubscriptions);
          await sendPush(
            userData.pushSubscriptions,
            "Trening danas",
            `Vaš Boxing Cardio trening u ${sessionData.startTime} je danas!`,
            reminderSubMap
          );
        }
      }
    }
  }
);
