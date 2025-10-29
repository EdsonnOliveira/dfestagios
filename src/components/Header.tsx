import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { whatsapp } from '../constants/var';

interface HeaderProps {
  currentPage?: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPage]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-gradient-to-r from-[#004085] to-[#007BFF] text-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-sm font-medium">Central de Atendimento:</span>
          <div className="flex items-center gap-2">
            <Image src="/phone.svg" alt="Phone" width={16} height={16} />
            <a 
              href={`https://wa.me/${whatsapp}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-[#0056B3] transition-colors flex items-center gap-1"
            >
              <Image src="/whatsapp-icon.svg" alt="WhatsApp" width={14} height={14} />
              (61) 99962-9819
            </a>
          </div>
        </div>
      </header>

      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white shadow-lg' 
          : 'bg-white bg-opacity-90 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center py-4 px-4">
          <Link href="/">
            <Image src="/logo.png" alt="DF ESTÁGIOS" width={200} height={60} />
          </Link>
          
          <div className="hidden md:flex gap-8 font-medium">
            <Link 
              href="/conheca" 
              className={`hover:underline transition-colors text-[#004085] ${
                currentPage === 'conheca' ? 'font-bold' : ''
              }`}
            >
              Conheça a DF ESTÁGIOS
            </Link>
            <Link 
              href="/estudante" 
              className={`hover:underline transition-colors text-[#004085] ${
                currentPage === 'estudante' ? 'font-bold' : ''
              }`}
            >
              Sou Estudante
            </Link>
            <Link
              href="/empresa"
              className={`hover:underline transition-colors text-[#004085] ${
                currentPage === 'empresa' ? 'font-bold' : ''
              }`}
            >
              Sou Empresa
            </Link>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline transition-colors text-[#004085] flex items-center gap-1"
            >
              <Image src="/whatsapp-icon.svg" alt="WhatsApp" width={16} height={16} />
              Fale conosco
            </a>
          </div>

          <button
            onClick={toggleMobileMenu}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 space-y-1"
            aria-label="Toggle mobile menu"
          >
            <span className={`block w-6 h-0.5 bg-[#004085] transition-all duration-300 ${
              isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
            }`}></span>
            <span className={`block w-6 h-0.5 bg-[#004085] transition-all duration-300 ${
              isMobileMenuOpen ? 'opacity-0' : ''
            }`}></span>
            <span className={`block w-6 h-0.5 bg-[#004085] transition-all duration-300 ${
              isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
            }`}></span>
          </button>
        </div>

        <div className={`md:hidden fixed top-0 left-0 w-full h-screen bg-[#00408580] z-[9999] transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} onClick={closeMobileMenu}></div>

        <div className={`md:hidden fixed top-0 right-0 h-screen w-64 bg-white shadow-lg z-[10000] transform transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="flex flex-col p-6 space-y-6">
            <div className="flex justify-between items-center">
              <button
                onClick={closeMobileMenu}
                className="text-[#004085] hover:text-[#007BFF] transition-colors"
                aria-label="Close mobile menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col space-y-4 font-medium">
              <Link 
                href="/conheca" 
                onClick={closeMobileMenu}
                className={`py-2 px-4 rounded-lg transition-colors text-[#004085] hover:bg-[#004085] hover:text-white ${
                  currentPage === 'conheca' ? 'bg-[#004085] text-white font-bold' : ''
                }`}
              >
                Conheça a DF ESTÁGIOS
              </Link>
              <Link 
                href="/estudante" 
                onClick={closeMobileMenu}
                className={`py-2 px-4 rounded-lg transition-colors text-[#004085] hover:bg-[#004085] hover:text-white ${
                  currentPage === 'estudante' ? 'bg-[#004085] text-white font-bold' : ''
                }`}
              >
                Sou Estudante
              </Link>
              <Link
                href="/empresa"
                onClick={closeMobileMenu}
                className={`py-2 px-4 rounded-lg transition-colors text-[#004085] hover:bg-[#004085] hover:text-white ${
                  currentPage === 'empresa' ? 'bg-[#004085] text-white font-bold' : ''
                }`}
              >
                Sou Empresa
              </Link>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                className="py-2 px-4 rounded-lg transition-colors text-[#004085] hover:bg-[#004085] hover:text-white flex items-center gap-2"
              >
                Fale conosco
              </a>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
