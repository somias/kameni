"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onBookingReminder = exports.onBookingCancelled = exports.onBookingCreated = exports.onAnnouncementCreated = exports.onSessionCancelled = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const webpush = __importStar(require("web-push"));
admin.initializeApp();
const db = admin.firestore();
const vapidPrivateKey = (0, params_1.defineSecret)("VAPID_PRIVATE_KEY");
const VAPID_PUBLIC_KEY = "BLHeT0sFe02Vv-_7zpg7UVU2B896LYWb9UpaJpvQ-jVrRnlSbhuxTSlkClYIO_AIa8N33KjzmlrkFcbb-ConpEE";
function initWebPush() {
    webpush.setVapidDetails("mailto:admin@kamenko.web.app", VAPID_PUBLIC_KEY, vapidPrivateKey.value());
}
async function sendPush(subscriptions, title, body) {
    if (subscriptions.length === 0)
        return;
    initWebPush();
    const payload = JSON.stringify({ title, body, url: "/schedule" });
    const results = await Promise.allSettled(subscriptions.map((sub) => webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: sub.keys,
    }, payload)));
    const success = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    console.log(`Push sent: ${success} success, ${failed} failure`);
}
// Trigger: When a session status changes to 'cancelled'
exports.onSessionCancelled = (0, firestore_1.onDocumentUpdated)({
    document: "sessions/{sessionId}",
    secrets: [vapidPrivateKey],
}, async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    if (before.status === "cancelled" || after.status !== "cancelled")
        return;
    const sessionId = event.params.sessionId;
    const bookingsSnap = await db
        .collection("bookings")
        .where("sessionId", "==", sessionId)
        .where("status", "==", "confirmed")
        .get();
    if (bookingsSnap.empty)
        return;
    const subscriptions = [];
    for (const bookingDoc of bookingsSnap.docs) {
        const userId = bookingDoc.data().userId;
        const userSnap = await db.collection("users").doc(userId).get();
        const userData = userSnap.data();
        if ((userData === null || userData === void 0 ? void 0 : userData.notificationsEnabled) &&
            ((_c = userData === null || userData === void 0 ? void 0 : userData.pushSubscriptions) === null || _c === void 0 ? void 0 : _c.length) > 0) {
            subscriptions.push(...userData.pushSubscriptions);
        }
    }
    const startTime = after.startTime || "";
    const date = after.date || "";
    const cancelNote = after.cancelNote ? ` Note: ${after.cancelNote}` : "";
    await sendPush(subscriptions, "Session Cancelled", `The ${startTime} session on ${date} has been cancelled.${cancelNote}`);
});
// Trigger: When a new announcement is posted
exports.onAnnouncementCreated = (0, firestore_1.onDocumentWritten)({
    document: "announcements/current",
    secrets: [vapidPrivateKey],
}, async (event) => {
    var _a, _b;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    if (!after || !after.message)
        return;
    const postedByUid = after.postedByUid || "";
    const usersSnap = await db
        .collection("users")
        .where("notificationsEnabled", "==", true)
        .get();
    const subscriptions = [];
    for (const userDoc of usersSnap.docs) {
        if (userDoc.id === postedByUid)
            continue;
        const userData = userDoc.data();
        if (((_b = userData.pushSubscriptions) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            subscriptions.push(...userData.pushSubscriptions);
        }
    }
    await sendPush(subscriptions, "New Announcement", after.message);
});
// Trigger: When a new booking is created, notify the coach
exports.onBookingCreated = (0, firestore_1.onDocumentCreated)({
    document: "bookings/{bookingId}",
    secrets: [vapidPrivateKey],
}, async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.status !== "confirmed")
        return;
    const userName = data.userName || "A member";
    const sessionDate = data.sessionDate || "";
    const startTime = data.sessionStartTime || "";
    const coachSnap = await db
        .collection("users")
        .where("role", "==", "coach")
        .get();
    if (coachSnap.empty)
        return;
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
        if (coachData.notificationsEnabled &&
            ((_b = coachData.pushSubscriptions) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            await sendPush(coachData.pushSubscriptions, title, message);
        }
    }
});
// Trigger: When a booking is cancelled by a member, notify the coach
exports.onBookingCancelled = (0, firestore_1.onDocumentUpdated)({
    document: "bookings/{bookingId}",
    secrets: [vapidPrivateKey],
}, async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    if (before.status === "cancelled" || after.status !== "cancelled")
        return;
    const userName = after.userName || "A member";
    const sessionDate = after.sessionDate || "";
    const startTime = after.sessionStartTime || "";
    const coachSnap = await db
        .collection("users")
        .where("role", "==", "coach")
        .get();
    if (coachSnap.empty)
        return;
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
        if (coachData.notificationsEnabled &&
            ((_c = coachData.pushSubscriptions) === null || _c === void 0 ? void 0 : _c.length) > 0) {
            await sendPush(coachData.pushSubscriptions, title, message);
        }
    }
});
// Scheduled: Daily booking reminders at 8:00 AM
exports.onBookingReminder = (0, scheduler_1.onSchedule)({
    schedule: "0 8 * * *",
    timeZone: "America/New_York",
    secrets: [vapidPrivateKey],
}, async () => {
    var _a;
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const sessionsSnap = await db
        .collection("sessions")
        .where("date", "==", dateStr)
        .where("status", "==", "scheduled")
        .get();
    if (sessionsSnap.empty)
        return;
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
            if ((userData === null || userData === void 0 ? void 0 : userData.notificationsEnabled) &&
                ((_a = userData === null || userData === void 0 ? void 0 : userData.pushSubscriptions) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                await sendPush(userData.pushSubscriptions, "Session Today", `Your ${sessionData.startTime} boxing cardio session is today!`);
            }
        }
    }
});
//# sourceMappingURL=index.js.map