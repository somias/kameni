export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'coach' | 'member';
  notificationsEnabled: boolean;
  pushSubscriptions: PushSubscriptionJSON[];
  createdAt: string;
}

export interface Slot {
  id: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  location: string;
  maxCapacity: number;
  active: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  slotId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  location: string;
  maxCapacity: number;
  bookingCount: number;
  status: 'scheduled' | 'cancelled';
  cancelNote?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  sessionId: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  sessionLocation: string;
  status: 'confirmed' | 'cancelled';
  checkedIn: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string; // specific user ID or 'all' for broadcast
  type: 'booking_confirmed' | 'booking_cancelled' | 'session_cancelled' | 'announcement' | 'reminder' | 'spot_available';
  title: string;
  message: string;
  read: boolean;
  relatedSessionId?: string;
  createdAt: string;
}

export interface Announcement {
  message: string;
  postedBy: string;
  postedAt: string;
}
