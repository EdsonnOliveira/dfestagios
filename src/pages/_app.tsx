import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Toaster } from "react-hot-toast";
import '../lib/firebase';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function AppShell({ Component, pageProps }: AppProps) {
  const { isDark } = useTheme();
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: isDark
            ? {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155'
              }
            : {
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0'
              }
        }}
      />
      <Head>
        <title>DF Estágios</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default function App(props: AppProps) {
  return (
    <ThemeProvider>
      <AppShell {...props} />
    </ThemeProvider>
  );
}
