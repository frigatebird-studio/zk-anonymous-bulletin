/* eslint-disable @next/next/no-sync-scripts */
"use client";

import { TonConnectButton } from "@tonconnect/ui-react";
import { useState } from "react";
import { DAPP_BULLETIN_LIST } from "@/constants";
import Bulletin from "@/components/bulletin";

export default function Home() {
  const [bulletinIndex, setBulletinIndex] = useState<number>(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Anonymous Bulletin</h1>
      <TonConnectButton className="my-button-class" />
      <div className="flex-col space-x-2">
        {DAPP_BULLETIN_LIST.map((b, index) => (
          <button
            key={index}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => setBulletinIndex(index)}
          >
            {b.name}
          </button>
        ))}
      </div>
      <Bulletin metadata={DAPP_BULLETIN_LIST[bulletinIndex]} />
    </main>
  );
}
