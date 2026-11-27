import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import { isStudentAccountEmail } from '../lib/studentAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isStudent = isStudentAccountEmail(user?.email);
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;

    if (user && !isStudent) return;

    if (user && isStudent) {
      void router.replace('/area-estudante');
      return;
    }

    const delayMs = hadUserRef.current ? 800 : 0;
    const timer = window.setTimeout(() => {
      const current = auth.currentUser;
      if (current && !isStudentAccountEmail(current.email)) {
        window.dispatchEvent(new Event('df-auth-sync'));
        return;
      }
      if (current && isStudentAccountEmail(current.email)) {
        window.dispatchEvent(new Event('df-auth-sync'));
        void router.replace('/area-estudante');
        return;
      }
      void router.replace('/login');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [loading, user, isStudent, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004085] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || isStudent) {
    if (hadUserRef.current && !user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004085] mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}
