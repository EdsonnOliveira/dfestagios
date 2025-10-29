import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Image from 'next/image';

export default function Estudante() {
  return (
    <div className="min-h-screen bg-white">
      <Header currentPage="estudante" />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-12 sm:mb-16">
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="w-full h-64 sm:h-96 flex items-center justify-center">
                <div className="text-center">
                  <Image src="/vem.png" alt="DF Estágios" width={600} height={600} className="object-cover rounded-lg" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl mt-16 md:mt-0 md:text-5xl font-bold mb-4 sm:mb-6 px-4 lg:px-0">
              <span className="text-green-600">#VEMPRA</span>
              <span className="text-[#004085]">DFESTAGIOS</span>
            </h1>
            <div className="text-base sm:text-lg text-gray-700 leading-relaxed px-4 lg:px-0">
              <p className="mb-4 sm:mb-6">
              Nós enxergamos o estágio como uma fase essencial na trajetória acadêmica e profissional. Não é apenas uma experiência temporária, mas sim uma oportunidade em que a empresa aposta no talento do estudante, oferecendo espaço para que ele desenvolva suas competências na prática. Com isso, a organização não ganha só um estagiário, mas alguém engajado, dedicado e alinhado aos seus objetivos.
              </p>
              <p>
              Nossa missão é conectar estudantes ao mercado de trabalho por meio de processos de recrutamento e seleção, contribuindo para que as empresas formem equipes mais capacitadas e preparadas para o futuro.
              </p>
            </div>
          </div>
        </div>

        <section className="bg-gradient-to-r from-[#004085] to-[#007BFF] py-12 sm:py-16 px-4 rounded-lg">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6 px-4">Faça seu cadastro</h2>
            <p className="text-white text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed px-4">
              Para acessar as melhores oportunidades de estágio, preencha o seu cadastro e mantenha sempre atualizado. Cadastre-se agora mesmo!
            </p>
            <Link href="/formulario" className="inline-block bg-[#FFC107] hover:bg-[#FFD700] text-black font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-lg text-base sm:text-lg transition-colors shadow-lg">
              Fazer o meu cadastro
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
