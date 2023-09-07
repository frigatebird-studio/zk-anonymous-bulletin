/* eslint-disable @next/next/no-sync-scripts */
"use client";

import { buffer2bits } from "@/utilities";
import {
  TonConnectButton,
  TonConnectUIProvider,
  useTonWallet,
} from "@tonconnect/ui-react";
import { Dispatch, useEffect, useState } from "react";
const buildEddsa = require("circomlibjs").buildEddsaBls;
const buildBabyjub = require("circomlibjs").buildBabyJubBls;

type Status =
  | "uninitialized"
  | "start to generate proof..."
  | "generate proving key..."
  | "generate proof..."
  | "done generating proof";

async function generateProof(setStatus: Dispatch<Status>) {
  const snarkjs = window.snarkjs;
  const lZString = window.LZString;
  const localStorage = window.localStorage;
  const Z_KEY_DATA_CACHE_INDEX = "zKeyData";
  const V_KEY_CACHE_INDEX = "vKey";

  setStatus("start to generate proof...");

  const ptau_final = "/data/pot14_final.ptau";
  const r1cs = "/circuits/group.r1cs";
  const wasm = "/circuits/group.wasm";
  const zkey_0 = { type: "mem" };
  const zkey_1 = { type: "mem" };
  const zkey_final: { type: "mem"; data?: Uint8Array } = { type: "mem" };
  const wtns = { type: "mem" };

  let zKeyDataString = localStorage.getItem(Z_KEY_DATA_CACHE_INDEX);
  let vKeyString = localStorage.getItem(V_KEY_CACHE_INDEX);
  if (!zKeyDataString || !vKeyString) {
    setStatus("generate proving key...");

    const t1 = new Date();

    await snarkjs.zKey.newZKey(r1cs, ptau_final, zkey_0);

    await snarkjs.zKey.contribute(zkey_0, zkey_1, "p2_C1", "pa_Entropy1");

    await snarkjs.zKey.beacon(
      zkey_1,
      zkey_final,
      "B3",
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      10
    );

    const verifyFromR1csResult = await snarkjs.zKey.verifyFromR1cs(
      r1cs,
      ptau_final,
      zkey_final
    );
    console.assert(verifyFromR1csResult);

    const verifyFromInit = await snarkjs.zKey.verifyFromInit(
      zkey_0,
      ptau_final,
      zkey_final
    );
    console.assert(verifyFromInit);

    const _zKeyDataString = Buffer.from(zkey_final.data!).toString("hex");
    zKeyDataString = lZString.compress(_zKeyDataString);
    if (lZString.decompress(zKeyDataString).length !== _zKeyDataString.length) {
      throw new Error(
        `${lZString.decompress(zKeyDataString).length} !== ${
          _zKeyDataString.length
        }`
      );
    }
    localStorage.setItem(Z_KEY_DATA_CACHE_INDEX, zKeyDataString!);

    vKeyString = JSON.stringify(
      await snarkjs.zKey.exportVerificationKey(zkey_final)
    );
    localStorage.setItem(V_KEY_CACHE_INDEX, vKeyString);

    const t2 = new Date();
    console.info(`generate zkey with ${t2.getTime() - t1.getTime()} ms`);
  }

  setStatus("generate proof...");

  // prepare data start
  const eddsa = await buildEddsa();
  const babyJub = await buildBabyjub();
  const msg = Buffer.from("00010203040506070809", "hex");
  const prvKey = Buffer.from(
    "0001020304050607080900010203040506070809000102030405060708090001",
    "hex"
  );
  const pubKey = eddsa.prv2pub(prvKey);
  const pPubKey = babyJub.packPoint(pubKey);
  const signature = eddsa.signPedersen(prvKey, msg);
  const pSignature = eddsa.packSignature(signature);
  const uSignature = eddsa.unpackSignature(pSignature);
  console.assert(eddsa.verifyPedersen(msg, uSignature, pubKey));

  const msgBits = buffer2bits(msg);
  const r8Bits = buffer2bits(pSignature.slice(0, 32));
  const sBits = buffer2bits(pSignature.slice(32, 64));
  const aBits = buffer2bits(pPubKey);

  const aBitsLeft = aBits.slice(0, 128);
  const aBitsRight = aBits.slice(128, 256);
  const aNumLeft = BigInt("0b" + aBitsLeft.reverse().join(""));
  const aNumRight = BigInt("0b" + aBitsRight.reverse().join(""));

  const input = {
    aNumList: [aNumLeft, aNumRight, aNumLeft, aNumRight],
    aNumIndex: 1,
    R8: r8Bits,
    S: sBits,
    msg: msgBits,
  };
  // prepare data end

  zkey_final.data = new Uint8Array(
    Buffer.from(lZString.decompress(zKeyDataString), "hex")
  );

  const vKey = JSON.parse(vKeyString);

  await snarkjs.wtns.calculate(input, wasm, wtns);

  await snarkjs.wtns.check(r1cs, wtns);

  const { proof, publicSignals } = await snarkjs.groth16.prove(
    zkey_final,
    wtns
  );

  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.assert(verified);

  setStatus("done generating proof");
  console.info(publicSignals);
}

async function sendTx() {
  console.log("123");
}

export default function Home() {
  const [status, setStatus] = useState<Status>("uninitialized");
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.snarkjs &&
      window.LZString &&
      window.localStorage
    ) {
      generateProof(setStatus);
    }
  }, []);
  // const wallet = useTonWallet();

  return (
    <TonConnectUIProvider manifestUrl="https://fdc-ai.github.io/assets/ton/tonconnect-manifest.json">
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <script src="//cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        <script src="/snarkjs.min.js"></script>
        <script src="/lz-string.min.js"></script>
        <h1 className="text-lg font-bold text-slate-900">
          Zero Knowledge Anonymous Bulletin
        </h1>
        <div>Status: {status}</div>
        {status === "done generating proof" ? (
          <TonConnectButton className="my-button-class" />
        ) : null}
        {/* {wallet} */}
        {status === "done generating proof" ? (
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={sendTx}
          >
            Send
          </button>
        ) : null}
      </main>
    </TonConnectUIProvider>
  );
}
