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

function initWebPush() {
  webpush.setVapidDetails(
    "mailto:admin@kamenko.web.app",
    VAPID_PUBLIC_KEY,
    vapidPrivateKey.value()
  );
}

async function sendPush(subscriptions: PushSub[], title: string, body: string) {
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
    for (const bookingDoc of bookingsSnap.docs) {
      const userId = bookingDoc.data().userId;
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.data();
      if (
        userData?.notificationsEnabled &&
        userData?.pushSubscriptions?.length > 0
      ) {
        subscriptions.push(...userData.pushSubscriptions);
      }
    }

    const startTime = after.startTime || "";
    const date = after.date || "";
    const cancelNote = after.cancelNote ? ` Note: ${after.cancelNote}` : "";

    await sendPush(
      subscriptions,
      "Session Cancelled",
      `The ${startTime} session on ${date} has been cancelled.${cancelNote}`
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
    for (const userDoc of usersSnap.docs) {
      if (userDoc.id === postedByUid) continue;
      const userData = userDoc.data();
      if (userData.pushSubscriptions?.length > 0) {
        subscriptions.push(...userData.pushSubscriptions);
      }
    }

    await sendPush(subscriptions, "New Announcement", after.message);
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

    const userName = data.userName || "A member";
    const sessionDate = data.sessionDate || "";
    const startTime = data.sessionStartTime || "";

    const coachSnap = await db
      .collection("users")
      .where("role", "==", "coach")
      .get();

    if (coachSnap.empty) return;

    const title = "New Booking";
    const message = `${userName} booked the ${startTime} session on ${sessionDate}.`;

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
        await sendPush(coachData.pushSubscriptions, title, message);
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

    const userName = after.userName || "A member";
    const sessionDate = after.sessionDate || "";
    const startTime = after.sessionStartTime || "";

    const coachSnap = await db
      .collection("users")
      .where("role", "==", "coach")
      .get();

    if (coachSnap.empty) return;

    const title = "Booking Cancelled";
    const message = `${userName} cancelled their ${startTime} session on ${sessionDate}.`;

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
        await sendPush(coachData.pushSubscriptions, title, message);
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
          title: "Session Today",
          message: `Your ${sessionData.startTime} boxing cardio session is today!`,
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
          await sendPush(
            userData.pushSubscriptions,
            "Session Today",
            `Your ${sessionData.startTime} boxing cardio session is today!`
          );
        }
      }
    }
  }
);
