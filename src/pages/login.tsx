import { useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authService } from '../services/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.signIn(email, senha);
      router.push('/painel');
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === 'auth/user-not-found') {
          setError('Usuário não encontrado');
        } else if (errorCode === 'auth/wrong-password') {
          setError('Senha incorreta');
        } else if (errorCode === 'auth/invalid-email') {
          setError('E-mail inválido');
        } else {
          setError('Erro ao fazer login. Tente novamente.');
        }
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header currentPage="login" />

      <main className="max-w-md mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] mb-2">Login Administrativo</h1>
            <p className="text-gray-600 text-sm sm:text-base">Acesso restrito ao painel de controle</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm sm:text-base">
              {error}
            </div>
          )}

          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                required
                disabled={loading}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded"
                  disabled={loading}
                />
                <span className="text-sm text-gray-600">Lembrar de mim</span>
              </label>
              <a
                href="/esqueci-senha"
                className="text-sm text-[#004085] hover:text-[#0056B3] hover:underline"
              >
                Esqueci minha senha
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#004085] hover:bg-[#0056B3] disabled:bg-gray-400 text-white font-bold py-2 sm:py-3 px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
