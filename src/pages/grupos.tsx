import Image from 'next/image';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { gruposService } from '../services/firebase';
import { Grupo } from '../types/firebase';

export default function Grupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const gruposData = await gruposService.getAll();
        setGrupos(gruposData);
      } catch (error) {
        console.error('Erro ao buscar grupos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGrupos();
  }, []);

  const openGrupo = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 px-4">
            <span className="text-[#25D366]">Grupos do</span>
            <span className="text-[#004085]"> WhatsApp</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-700 max-w-3xl mx-auto px-4">
            Entre nos grupos do WhatsApp e receba diariamente as melhores oportunidades de estágio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8 sm:py-12">
              <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#004085]"></div>
              <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Carregando grupos...</p>
            </div>
          ) : grupos.length > 0 ? (
            grupos.map((grupo) => (
              <div
                key={grupo.id}
                className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => openGrupo(grupo.link)}
              >
                <div className="flex items-center mb-3 sm:mb-4">
                  <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mr-3 sm:mr-4">
                    <Image src="/whatsapp-icon.svg" alt="WhatsApp" width={20} height={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#004085]">{grupo.titulo}</h3>
                </div>
                <button className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:from-[#128C7E] hover:to-[#075E54] transition-colors text-sm sm:text-base">
                  Entrar no grupo
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 sm:py-12">
              <p className="text-gray-600 text-sm sm:text-base">Nenhum grupo disponível no momento.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
