import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authService } from '../services/firebase';

const TOKEN_REFRESH_MS = 30 * 60 * 1000;

let keepAliveBound = false;
let keepAliveRefCount = 0;
let keepAliveIntervalId: number | null = null;

function refreshSession(force = false) {
  const current = auth.currentUser;
  if (!current) return;
  void current.getIdToken(force).catch(() => undefined);
}

function onVisibilityOrFocus() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  refreshSession(true);
}

function bindKeepAlive() {
  if (typeof window === 'undefined') return;
  keepAliveRefCount += 1;
  if (keepAliveBound) return;
  keepAliveBound = true;
  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  window.addEventListener('focus', onVisibilityOrFocus);
  keepAliveIntervalId = window.setInterval(() => {
    refreshSession(true);
  }, TOKEN_REFRESH_MS);
}

function unbindKeepAlive() {
  if (typeof window === 'undefined') return;
  keepAliveRefCount = Math.max(0, keepAliveRefCount - 1);
  if (keepAliveRefCount > 0 || !keepAliveBound) return;
  keepAliveBound = false;
  document.removeEventListener('visibilitychange', onVisibilityOrFocus);
  window.removeEventListener('focus', onVisibilityOrFocus);
  if (keepAliveIntervalId !== null) {
    window.clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const syncFromFirebase = () => {
      if (!active) return;
      setUser(auth.currentUser);
      setLoading(false);
    };

    bindKeepAlive();

    const unsubscribe = authService.onAuthStateChanged((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });

    void auth.authStateReady().then(syncFromFirebase).catch(() => undefined);
    window.addEventListener('df-auth-sync', syncFromFirebase);

    return () => {
      active = false;
      unsubscribe();
      unbindKeepAlive();
      window.removeEventListener('df-auth-sync', syncFromFirebase);
    };
  }, []);

  return useMemo(() => ({ user, loading }), [user, loading]);
}
