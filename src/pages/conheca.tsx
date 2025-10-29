import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Image from 'next/image';

export default function Conheca() {
  return (
    <div className="min-h-screen bg-white">
            <Header currentPage="conheca" />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#004085] mb-4 sm:mb-6 px-4">
            DF Estágios — Aproximando Estudantes e Empresas
            </h1>
            <div className="max-w-4xl mx-auto text-base sm:text-lg text-gray-700 leading-relaxed px-4">
              <p className="mb-4 sm:mb-6">
              Na DF Estágios, acreditamos que oportunidade e talento precisam se encontrar de forma simples, ágil e sem burocracia.
              </p>
              <p className="mb-4 sm:mb-6">
              Há anos conectamos empresas de diferentes segmentos a estagiários preparados, enquanto auxiliamos estudantes a darem seus primeiros passos no mercado de trabalho, sempre em conformidade com a Lei nº 11.788/2008.
              </p>
              <p>
                Nosso diferencial está em oferecer um suporte completo: da seleção dos candidatos até a formalização e acompanhamento de todo o estágio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="w-full h-64 sm:h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="flex justify-center items-end gap-2 sm:gap-4">
                    <Image src="/estudantes.png" alt="DF Estágios" width={400} height={400} className="object-cover rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFC107] p-6 sm:p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6 leading-tight">
              Grandes empresas encontram grandes talentos na DF Estágios
            </h1>
            <p className="text-black text-base sm:text-lg leading-relaxed">
              Atuamos com expertise em recrutamento, seleção e contratação de estagiários. Já auxiliamos milhares de jovens a ingressarem no mercado de trabalho. Nosso papel é simplificar cada etapa da contratação, garantindo praticidade tanto para empresas quanto para estudantes.
            </p>
          </div>
        </div>
        <section className="bg-gradient-to-r from-[#004085] to-[#007BFF] py-12 sm:py-16 px-4 mt-12 sm:mt-16">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-8 sm:mb-12 px-4">Nossos números</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              <div className="bg-[#007BFF] p-4 sm:p-6 rounded-lg text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-2">+10</div>
                <div className="text-white text-sm sm:text-lg">anos de mercado</div>
              </div>
              
              <div className="bg-[#007BFF] p-4 sm:p-6 rounded-lg text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-2">+1.000</div>
                <div className="text-white text-sm sm:text-lg">de atendimentos diários</div>
              </div>
              
              <div className="bg-[#007BFF] p-4 sm:p-6 rounded-lg text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-2">+50</div>
                <div className="text-white text-sm sm:text-lg">grupos do whatsapp</div>
              </div>
              
              <div className="bg-[#007BFF] p-4 sm:p-6 rounded-lg text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-2">+200</div>
                <div className="text-white text-sm sm:text-lg">entrevistas por semana</div>
              </div>
              
              <div className="bg-[#007BFF] p-4 sm:p-6 rounded-lg text-center col-span-2 sm:col-span-3 lg:col-span-1">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-2">+20.000</div>
                <div className="text-white text-sm sm:text-lg">seguidores nas redes sociais</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-12 sm:py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 relative">
                  <span className="block w-8 sm:w-12 h-0.5 bg-black mb-2"></span>
                  Nosso Trabalho
                </h3>
                <ul className="space-y-2 sm:space-y-3 text-black text-base sm:text-lg">
                  <p>Garantimos às empresas e aos estudantes um atendimento ágil, transparente e inovador. Cuidamos de toda a gestão do programa de estágio, assegurando que cada etapa esteja em conformidade com a Lei nº 11.788/2008.</p>
                </ul>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 relative">
                  <span className="block w-8 sm:w-12 h-0.5 bg-black mb-2"></span>
                  Nosso Objetivo
                </h3>
                <p className="text-black text-base sm:text-lg leading-relaxed">
                Para nós, o maior valor de uma empresa está nas pessoas. Por isso, nossa missão é identificar, selecionar e desenvolver talentos, conectando-os às melhores oportunidades e ajudando organizações a crescerem junto com seus estagiários.</p>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 relative">
                  <span className="block w-8 sm:w-12 h-0.5 bg-black mb-2"></span>
                  Nossa missão
                </h3>
                <p className="text-black text-base sm:text-lg leading-relaxed">
                  Acreditamos que o fator mais importante de uma organização são as pessoas. Por isso, recrutar, selecionar, reter e desenvolver talentos é a nossa missão.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="py-12 sm:py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/estudante" className="relative h-96 sm:h-80 overflow-hidden rounded-lg cursor-pointer hover:scale-105 transition-transform duration-300">
                <Image src="/procurando.png" alt="Procurando estágio" width={500} height={500} className="object-cover rounded-lg" />
                <div className="absolute inset-0 bg-[#00408560] mb-4"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-white text-xl sm:text-2xl font-bold text-center px-4">
                    Procurando estágio?
                  </h3>
                </div>
              </Link>

              <Link href="/empresa" className="relative h-64 sm:h-80 overflow-hidden rounded-lg cursor-pointer hover:scale-105 transition-transform duration-300">
                <Image src="/contratar.png" alt="Contratando estágio" width={500} height={500} className="object-cover rounded-lg" />
                <div className="absolute inset-0 bg-[#00408560] mb-4"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-white text-xl sm:text-2xl font-bold text-center px-4">
                    Querendo contratar?
                  </h3>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#004085] to-[#007BFF] py-12 sm:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 px-4">Para sua empresa</h2>
            <div className="w-16 sm:w-24 h-1 bg-white mx-auto mb-6 sm:mb-8"></div>
            <div className="text-white text-base sm:text-lg leading-relaxed text-left max-w-3xl mx-auto px-4">
              <p className="mb-4">
                A DF ESTÁGIOS é reconhecida pela excelência no recrutamento, seleção e gestão dos programas de estágio.
              </p>
              <p>
                O processo de seleção foi desenhado cuidadosamente para entregar uma experiência única que vai encantar e surpreender a sua empresa.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
