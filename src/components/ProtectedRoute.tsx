import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
import { isStudentAccountEmail } from '../lib/studentAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isStudent = isStudentAccountEmail(user?.email);

  useEffect(() => {
    if (!loading && (!user || isStudent)) {
      void router.replace(isStudent ? '/area-estudante' : '/login');
    }
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

  if (!user || isStudent) return null;

  return <>{children}</>;
}
