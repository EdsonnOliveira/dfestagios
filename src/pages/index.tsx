import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';

// import { whatsapp } from '../constants/var';

export default function Home() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { 
      id: 1, 
      image: '/bg-1.jpg',
      title: 'Há mais de 10 anos',
      subtitle: 'Conectando talentos e oportunidades',
      cta: 'QUERO CONTRATAR'
    },
    { 
      id: 2, 
      image: '/bg-2.jpg',
      title: 'Estágios de qualidade',
      subtitle: 'Para estudantes e empresas',
      cta: 'QUERO CONTRATAR'
    },
    { 
      id: 3, 
      image: '/bg-3.webp',
      title: 'Processo simplificado',
      subtitle: 'Contratação rápida e segura',
      cta: 'QUERO CONTRATAR'
    }
  ];

  // const openWhatsApp = () => {
  //   const message = 'Olá! Gostaria de contratar estagiários através da DF Estágios.';
  //   const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  //   window.open(whatsappUrl, '_blank');
  // };

  const navigateToGrupos = () => {
    router.push('/grupos');
  };

  const navigateToEstudante = () => {
    router.push('/estudante');
  };

  const navigateToEmpresa = () => {
    router.push('/empresa');
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => {
      const next = (prev + 1) % slides.length;
      return next;
    });
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => {
      const next = (prev - 1 + slides.length) % slides.length;
      return next;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentSlide, slides.length]);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="relative h-[400px] sm:h-[500px] md:h-[600px] overflow-hidden pt-20 sm:pt-24">
        <div className="relative h-full">
          <Image
            src={slides[currentSlide].image}
            alt="Slide"
            fill
            className="object-cover transition-all duration-1000 ease-in-out"
            priority
          />
          {
            currentSlide === 0 && (
              <div className="absolute inset-0 bg-[#00408570]"></div>
            )
          }
          {
            currentSlide === 1 && (
              <div className="absolute inset-0 bg-[#FFC10750]"></div>
            )
          }
          {
            currentSlide === 2 && (
              <div className="absolute inset-0 bg-[#28A74550]"></div>
            )
          }
        </div>
        
        <div className="absolute inset-0 z-10 h-full max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 px-4">{slides[currentSlide].title}</h1>
              <p className="text-lg sm:text-xl text-white mb-6 sm:mb-8 px-4">{slides[currentSlide].subtitle}</p>
            </div>
          </div>

          <div className="absolute inset-y-0 left-2 sm:left-4 flex items-center">
            <button 
              onClick={prevSlide}
              className="p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <Image src="/chevron-left.svg" alt="Previous" width={20} height={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="absolute inset-y-0 right-2 sm:right-4 flex items-center">
            <button 
              onClick={nextSlide}
              className="p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <Image src="/chevron-right.svg" alt="Next" width={20} height={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="absolute bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-colors ${
                  index === currentSlide ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#004085] to-[#007BFF] text-white py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <span className="text-base sm:text-lg font-medium text-center">Contratação de estagiários simples e segura</span>
          <button 
            onClick={navigateToEmpresa}
            className="flex items-center gap-2 bg-[#FFC107] hover:bg-[#FFD700] text-[#004085] px-4 py-2 rounded transition-colors font-bold text-sm sm:text-base"
          >
            <Image src="/chevron-right-yellow.svg" alt="Arrow" width={16} height={16} />
            <span className="font-bold uppercase">QUERO CONTRATAR</span>
          </button>
        </div>
      </section>

      <section className="bg-white py-8 sm:py-12 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
          <button 
            onClick={navigateToEstudante}
            className="bg-[#28A745] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-medium hover:bg-[#218838] transition-colors text-sm sm:text-base"
          >
            Sou estudante
          </button>
          <button 
            onClick={navigateToEmpresa}
            className="bg-[#FFC107] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-medium hover:bg-[#E0A800] transition-colors text-sm sm:text-base"
          >
            Sou empresa
          </button>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-4 px-4">Seu caminho para o mercado de trabalho em 3 passos!</h2>
            <p className="text-base sm:text-lg text-black max-w-4xl mx-auto px-4">
              Cadastre-se agora mesmo e tenha acesso às melhores vagas. São oportunidades para estudantes do ensino médio, técnico e superior, em diversas áreas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                <span className="text-white text-xl sm:text-2xl font-bold">1</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4 px-4">1º passo: Faça seu cadastro</h3>
              <p className="text-gray-700 text-sm sm:text-base px-4">
                Cadastre-se pelo formulário e ele será enviado para a empresa.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                <span className="text-white text-xl sm:text-2xl font-bold">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4 px-4">2º passo: Seguir nossas redes sociais</h3>
              <p className="text-gray-700 text-sm sm:text-base px-4">
                Siga nossas redes sociais e fique por dentro das novas vagas.
              </p>
            </div>

            <div className="text-center sm:col-span-2 lg:col-span-1">
              <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                <span className="text-white text-xl sm:text-2xl font-bold">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4 px-4">3º passo: Marque sua entrevista</h3>
              <p className="text-gray-700 text-sm sm:text-base px-4">
                Entraremos em contato com você para agendar a entrevista.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#FFC107] to-[#FFD700] py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#004085] mb-4 sm:mb-6 text-center lg:text-left">Vantagens</h2>
              <p className="text-black text-base sm:text-lg mb-6 sm:mb-8 text-center lg:text-left">
                Para nós, o estágio vai além de uma experiência temporária dentro da empresa. É a oportunidade de enxergar o talento do estudante e ajudá-lo a transformar teoria em prática. Nesse processo, a empresa não recebe apenas um estagiário, mas sim um profissional em formação, engajado, proativo e alinhado com seus objetivos.
              </p>
              
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                    <Image src="/dollar-icon.svg" alt="Dollar" width={20} height={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-black font-medium text-xs sm:text-sm">Vagas remuneradas</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                    <Image src="/person-icon.svg" alt="Person" width={20} height={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-black font-medium text-xs sm:text-sm">Cadastro gratuito</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-gradient-to-br from-[#007BFF] to-[#004085] w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                    <Image src="/whatsapp-icon.svg" alt="WhatsApp" width={20} height={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-black font-medium text-xs sm:text-sm">Grupos de vagas</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-48 h-60 sm:w-64 sm:h-80 flex items-center justify-center">
                <Image src="/vantagens.png" alt="Vantagens" width={400} height={400} className="object-cover rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#004085] to-[#007BFF] py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFC107] mb-8 sm:mb-12 px-4">O QUE DIZEM SOBRE A DF ESTÁGIOS</h2>

          <div className="relative bg-white p-6 sm:p-8 rounded-lg shadow-lg max-w-3xl mx-auto">
            <p className="text-base sm:text-lg text-gray-800 mb-4">
              Local que me ajudou muito no início da minha carreira profissional, referência na busca por estágios, sou muito grato pelas oportunidades 🙌🙌
            </p>
            <div className="flex items-center justify-center mb-4">
              <span className="text-lg sm:text-xl font-semibold text-gray-900">Guilles Rodrigues</span>
            </div>
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 fill-current" viewBox="0 0 24 24">
                  <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 3.887 1.48-8.279L.001 9.306l8.332-1.151L12 .587z"/>
                </svg>
              ))}
            </div>

            <button className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-[#004085] to-[#007BFF] p-1 sm:p-2 rounded-full shadow-md hover:from-[#003366] hover:to-[#0056B3] transition-colors">
              <Image src="/chevron-left.svg" alt="Previous" width={20} height={20} className="sm:w-6 sm:h-6" />
            </button>
            <button className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-[#004085] to-[#007BFF] p-1 sm:p-2 rounded-full shadow-md hover:from-[#003366] hover:to-[#0056B3] transition-colors">
              <Image src="/chevron-right.svg" alt="Next" width={20} height={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center mt-6 sm:mt-8 gap-4">
            <div className="flex items-center bg-white p-3 rounded-full shadow-md">
              <Image src="/google-logo.svg" alt="Google" width={20} height={20} className="sm:w-6 sm:h-6" />
              <span className="text-gray-800 font-medium ml-2 text-sm sm:text-base">Google</span>
            </div>
            <div className="bg-gradient-to-r from-[#004085] to-[#007BFF] text-white p-3 rounded-lg shadow-md flex flex-col items-center">
              <span className="text-xs sm:text-sm font-medium">Avaliações</span>
              <span className="text-xs sm:text-sm font-medium">Verificadas</span>
              <div className="flex gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 sm:w-4 sm:h-4 text-[#FFC107] fill-current" viewBox="0 0 24 24">
                    <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 3.887 1.48-8.279L.001 9.306l8.332-1.151L12 .587z"/>
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="lg:w-1/2 flex justify-center">
            <div className="p-4 sm:p-8 w-64 sm:w-80 h-48 sm:h-64 flex items-center justify-center">
              <Image src="/oportunidade.jpg" alt="Estágio" width={400} height={400} className="object-cover rounded-lg" />
            </div>
          </div>
          <div className="lg:w-1/2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-4 flex items-center justify-center lg:justify-start">
              Não perca nenhuma oportunidade!
              <Image src="/whatsapp-logo.svg" alt="WhatsApp Logo" width={28} height={28} className="ml-2 sm:ml-3 sm:w-9 sm:h-9" />
            </h2>
            <p className="text-base sm:text-lg text-gray-700 mb-4 px-4 lg:px-0">
            Entre para o grupo exclusivo da DF Estágios no WhatsApp e receba diariamente novas vagas.
            </p>
            <p className="text-base sm:text-lg text-gray-700 mb-6 sm:mb-8 px-4 lg:px-0">
              Estágio fácil, rápido e direto no seu celular.
            </p>
            <button 
              onClick={navigateToGrupos}
              className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-full text-base sm:text-lg hover:from-[#128C7E] hover:to-[#075E54] transition-colors shadow-lg"
            >
              Entrar no grupo do whatsapp
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
