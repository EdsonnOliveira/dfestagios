import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import '../lib/firebase';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Head>
        <title>DF Estágios</title>
      </Head>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
