import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  googleProvider,
  onAuthStateChanged,
  isFirebaseConfigured,
  type User,
} from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  demoLogin: () => void;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return unsubscribe;
    } catch {
      // Fallback if Firebase backend not reachable
      setLoading(false);
    }
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err.code || '';
    if (code.includes('invalid-api-key') || code.includes('api-key-not-valid') || err.message?.includes('API key not valid')) {
      return 'Firebase API key is unconfigured or invalid. Please configure VITE_FIREBASE_API_KEY in your environment/Vercel settings, or click "⚡ Continue as Demo Admin" below.';
    }
    if (code.includes('unauthorized-domain')) {
      return 'This domain is not authorized in Firebase Auth. Add this domain (e.g. domainguard-five.vercel.app or localhost) to Firebase Console > Authentication > Settings > Authorized Domains.';
    }
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Invalid email or password. Please verify your credentials.';
    }
    if (code.includes('email-already-in-use')) {
      return 'An account with this email address already exists.';
    }
    if (code.includes('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (code.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'Sign-in popup was closed before completing.';
    }
    return err.message || 'Authentication failed. Please try again.';
  };

  const demoLogin = () => {
    setError(null);
    setUser({
      email: 'admin@domainguard.example',
      uid: 'demo-local-admin-12345',
      emailVerified: true,
      displayName: 'Demo Registrar Admin',
    } as any);
  };

  const checkConfig = () => {
    if (!isFirebaseConfigured) {
      const msg = 'Firebase is not configured. Please set VITE_FIREBASE_API_KEY in your environment/Vercel settings, or click "⚡ Continue as Demo Admin" to test in offline mode.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const signIn = async (email: string, pass: string) => {
    setError(null);
    checkConfig();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (email: string, pass: string) => {
    setError(null);
    checkConfig();
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logOut = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    checkConfig();
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    checkConfig();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isConfigured: isFirebaseConfigured,
        signIn,
        signUp,
        demoLogin,
        logOut,
        resetPassword,
        signInWithGoogle,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
