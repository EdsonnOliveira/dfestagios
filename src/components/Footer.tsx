import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white py-8 px-4 border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <p className="text-black text-sm mb-4">
            DF Estágios - Todos os direitos reservados
          </p>
          <div className="flex justify-center items-center gap-6">
            <a
              href="https://www.instagram.com/estagiosdf?igsh=MThhajBkMW02Mm5m&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Image
                src="/instagram.png"
                alt="Instagram"
                width={24}
                height={24}
                className="mr-2"
              />
              <span className="text-sm">@estagiosdf</span>
            </a>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
