import Image from 'next/image';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { whatsapp } from '../constants/var';

export default function Empresa() {
  return (
    <div className="min-h-screen bg-white">
      <Header currentPage="empresa" />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="mb-12 sm:mb-16">
          <div className="bg-gradient-to-r from-[#004085] to-[#007BFF] p-6 sm:p-8 rounded-lg">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#FFC107] mb-6 sm:mb-8 text-center px-4">Benefícios de contar com estagiários na sua empresa</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">1.</span>
                  <p className="text-white text-base sm:text-lg">O estágio não gera vínculo empregatício formal</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">2.</span>
                  <p className="text-white text-base sm:text-lg">Não há incidência de encargos trabalhistas como INSS, FGTS ou 13º salário</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">3.</span>
                  <p className="text-white text-base sm:text-lg">O contrato pode ser encerrado a qualquer momento, sem multas ou penalidades</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">4.</span>
                  <p className="text-white text-base sm:text-lg">A bolsa-auxílio não possui valor mínimo obrigatório definido por lei</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">5.</span>
                  <p className="text-white text-base sm:text-lg">Contribui para a formação de um quadro de profissionais capacitados</p>
                </div>
              </div>
              
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">6.</span>
                  <p className="text-white text-base sm:text-lg">Jornada flexível: até 6 horas por dia ou 30 horas semanais</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">7.</span>
                  <p className="text-white text-base sm:text-lg">Possibilita identificar e desenvolver talentos que podem ser o futuro da sua organização</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">8.</span>
                  <p className="text-white text-base sm:text-lg">Reforça o papel social da empresa, ajudando na preparação de novos profissionais</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">9.</span>
                  <p className="text-white text-base sm:text-lg">Garante constante renovação e inovação dentro do ambiente corporativo</p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">10.</span>
                  <p className="text-white text-base sm:text-lg">E o melhor: a DF Estágios assume todo o processo para a sua empresa</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-gray-200">
            <div className="mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Sobre a Empresa</h3>
              <div className="space-y-3 sm:space-y-4 text-black text-base sm:text-lg leading-relaxed">
                <p>
                  Para nós, o estágio vai muito além de uma simples passagem do estudante pela organização. É um momento em que a empresa aposta em seu potencial, oferecendo espaço para que ele aprimore suas habilidades práticas e se desenvolva profissionalmente. Assim, não se recebe apenas um estagiário, mas sim um colaborador engajado, proativo e alinhado aos objetivos da companhia.
                </p>
                <p>
                  Compreendemos a cultura da sua empresa e buscamos os candidatos mais adequados para cada oportunidade disponível.
                </p>
                <p>
                  Oferecer vagas de estágio significa abrir caminho para novos talentos e contribuir ativamente para o futuro dos jovens.
                </p>
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-4">Quer contratar estagiários?</h3>
              <p className="text-black text-base sm:text-lg mb-4 sm:mb-6">Fale com nossos especialistas pelo whatsapp</p>
              <div className="text-center mb-4 sm:mb-6">
                <p className="text-black text-base sm:text-lg mb-2">Entre em contato:</p>
                <a 
                  href={`https://wa.me/${whatsapp}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#007BFF] font-bold text-base sm:text-lg hover:text-[#0056B3] transition-colors flex items-center gap-2 justify-center"
                >
                  <Image src="/whatsapp-icon.svg" alt="WhatsApp" width={16} height={16} className="sm:w-5 sm:h-5" />
                  (61) 99962-9819
                </a>
              </div>
              
              <div className="relative mb-4 sm:mb-6">
                <div className="w-48 sm:w-64 h-36 sm:h-48 mx-auto flex items-center justify-center">
                  <Image src="/sobre.png" alt="DF Estágios" width={600} height={600} className="object-cover rounded-lg" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-lg border border-gray-200">
            <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Por que escolher a DF Estágios?</h3>
            
            <ul className="space-y-2 sm:space-y-3 text-black text-base sm:text-lg mb-6 sm:mb-8">
              <li>• Mais de 10 anos de experiência no mercado</li>
              <li>• Especialização em recrutamento, seleção e gestão de estagiários</li>
              <li>• Banco de dados completo com estudantes de diversas áreas</li>
              <li>• Processos ágeis e sem burocracia</li>
              <li>• Suporte jurídico especializado</li>
              <li>• Sem necessidade de contrato de fidelidade</li>
              <li>• Rapidez e eficiência em todas as etapas</li>
              <li>• Relatórios, avisos e recibos disponíveis online</li>
            </ul>

            <h4 className="text-lg sm:text-xl font-bold text-black mb-4 sm:mb-6">Toda a parte burocrática? Nós simplificamos para você.</h4>

            <div className="relative">
              <div className="p-4 sm:p-8 w-full h-48 sm:h-64 mt-20 flex items-center justify-center">
                <Image src="/escolher.png" alt="DF Estágios" width={400} height={400} className="object-cover rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
