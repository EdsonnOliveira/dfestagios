import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authService } from '../services/firebase';

const TOKEN_REFRESH_MS = 45 * 60 * 1000;

let keepAliveBound = false;
let keepAliveRefCount = 0;
let keepAliveIntervalId: number | null = null;

function refreshSession() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  const current = auth.currentUser;
  if (!current) return;
  void current.getIdToken(false).catch(() => undefined);
}

function bindKeepAlive() {
  if (typeof window === 'undefined') return;
  keepAliveRefCount += 1;
  if (keepAliveBound) return;
  keepAliveBound = true;
  document.addEventListener('visibilitychange', refreshSession);
  window.addEventListener('focus', refreshSession);
  keepAliveIntervalId = window.setInterval(refreshSession, TOKEN_REFRESH_MS);
}

function unbindKeepAlive() {
  if (typeof window === 'undefined') return;
  keepAliveRefCount = Math.max(0, keepAliveRefCount - 1);
  if (keepAliveRefCount > 0 || !keepAliveBound) return;
  keepAliveBound = false;
  document.removeEventListener('visibilitychange', refreshSession);
  window.removeEventListener('focus', refreshSession);
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

    void auth.authStateReady().catch(() => undefined);
    bindKeepAlive();

    const unsubscribe = authService.onAuthStateChanged((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
      unbindKeepAlive();
    };
  }, []);

  return useMemo(() => ({ user, loading }), [user, loading]);
}
