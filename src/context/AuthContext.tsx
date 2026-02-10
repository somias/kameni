import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { User } from '../types';

interface AuthContextValue {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getOrCreateUserDoc(firebaseUser: FirebaseUser, displayName?: string): Promise<User> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { uid: firebaseUser.uid, ...userSnap.data() } as User;
  }

  // Check if any users exist — first user becomes coach
  const usersQuery = query(collection(db, 'users'), limit(1));
  const usersSnap = await getDocs(usersQuery);
  const role = usersSnap.empty ? 'coach' : 'member';

  const newUser: Omit<User, 'uid'> = {
    email: firebaseUser.email || '',
    displayName: displayName || firebaseUser.displayName || 'User',
    role,
    notificationsEnabled: false,
    pushSubscriptions: [],
    createdAt: new Date().toISOString(),
  };

  await setDoc(userRef, newUser);
  return { uid: firebaseUser.uid, ...newUser };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const data = await getOrCreateUserDoc(firebaseUser);
        setUserData(data);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const data = await getOrCreateUserDoc(cred.user, name);
    setUserData(data);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserData(null);
  };

  const refreshUser = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      setUserData({ uid: user.uid, ...userSnap.data() } as User);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signIn, signInWithGoogle, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
