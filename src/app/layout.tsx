/* eslint-disable @next/next/no-sync-scripts */
"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import Head from "next/head";
import { TonConnect, TonConnectUIProvider } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connector, setConnector] = useState<InstanceType<
    typeof TonConnect
  > | null>(null);

  useEffect(() => {
    if (window) {
      const newConnector = new TonConnect({
        manifestUrl: `${window.location.origin}/ton/tonconnect-manifest.json`,
        walletsListSource: `${window.location.origin}/ton/tonconnect-wallets.json`,
      });
      setConnector(newConnector);
    }
  }, []);

  return (
    <html lang="en">
      <Head>
        <meta name="title" content="Anonymous Bulletin" />
        <meta
          name="description"
          content="This is a website for anonymous bulletin boards using a zero knowledge approach"
        />
      </Head>
      <body className={inter.className}>
        {connector ? (
          <TonConnectUIProvider connector={connector}>
            {children}
          </TonConnectUIProvider>
        ) : null}
        {/* <script src="//cdn.jsdelivr.net/npm/eruda"></script>
          <script>eruda.init();</script> */}
        <script src="/snarkjs.min.js"></script>
        <script src="/lz-string.min.js"></script>
      </body>
    </html>
  );
}
