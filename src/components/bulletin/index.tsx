import {
  MAX_MSG_BITS_LENGTH,
  MAX_USER_LENGTH,
  MSG_PUBLIC_INPUT_SIZE,
} from "@/constants";
import { GroupZk } from "@/libraries/GroupZk";
import { BulletinMetadata } from "@/types";
import { getMessageBytesLength, hexDecode, hexEncode } from "@/utilities/str";
import {
  cell3ToInputList,
  getTonProvider,
  numberToBitArray,
} from "@/utilities/ton";
import {
  buffer2Bits,
  g1Compressed,
  g2Compressed,
  splitBits2Nums,
} from "@/utilities/zk";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { toNano } from "ton-core";
import { BOC } from "ton3-core";
import buildEddsa from "../../libraries/circomlibjs/eddsa_bls";
import buildBabyjub from "../../libraries/circomlibjs/babyjub_bls";
const buildBls12381 = require("ffjavascript").buildBls12381;
const unstringifyBigInts = require("ffjavascript").utils.unstringifyBigInts;

function _addUser(prvKey: any, eddsa: any, babyJub: any) {
  const pubKey = eddsa.prv2pub(prvKey);

  const pPubKey = babyJub.packPoint(pubKey);

  const aBits = buffer2Bits(pPubKey);

  return {
    prvKey,
    pubKey,
    pPubKey,
    aBits,
  };
}

function sendAddUser(prvKey: any, eddsa: any, babyJub: any) {
  const { pubKey, pPubKey, aBits } = _addUser(prvKey, eddsa, babyJub);

  return GroupZk.createAddUserPayload({
    pubInputs: splitBits2Nums(aBits),
  });
}

function formatMsg(msg: Buffer) {
  // 10 * 128 bits
  const paddingLength = MAX_MSG_BITS_LENGTH / 8 - msg.length;
  return Buffer.concat([msg, Buffer.alloc(paddingLength, 0)]);
}

function generateInput(
  msg: Buffer,
  privateKey: Buffer,
  users: any[],
  eddsa: any,
  babyJub: any
) {
  const { aBits, pubKey } = _addUser(privateKey, eddsa, babyJub);

  const signature = eddsa.signPedersen(privateKey, msg);

  const pSignature = eddsa.packSignature(signature);
  const uSignature = eddsa.unpackSignature(pSignature);

  console.assert(eddsa.verifyPedersen(msg, uSignature, pubKey));
  const msgBits = buffer2Bits(msg);
  const r8Bits = buffer2Bits(pSignature.slice(0, 32));
  const sBits = buffer2Bits(pSignature.slice(32, 64));

  const As = [];
  for (let i = 0; i < users.length; i++) {
    As.push(users[i].split("").map((bit: string) => parseInt(bit)));
  }

  const EMPTY_USER_ABITS = new Array(256).fill(0);
  for (let i = 0; i < MAX_USER_LENGTH - users.length; i++) {
    As.push(EMPTY_USER_ABITS);
  }

  let input = {
    AIndex: users.indexOf(aBits.join("")),
    As: As,
    R8: r8Bits,
    S: sBits,
    msg: msgBits,
  };

  return input;
}

async function generateProof(
  msg: Buffer,
  privateKey: Buffer,
  users: any[],
  eddsa: any,
  babyJub: any
): Promise<{ proof: any; publicSignals: any }> {
  const snarkjs = window.snarkjs;
  const wasm = "/circuits/group.wasm";
  const zkey_final: { type: "mem"; data?: Uint8Array } = { type: "mem" };

  zkey_final.data = new Uint8Array(
    Buffer.from(
      await (
        await (await fetch("/data/circuit_final.zkey")).blob()
      ).arrayBuffer()
    )
  );

  const input = generateInput(msg, privateKey, users, eddsa, babyJub);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasm,
    zkey_final
  );

  return {
    proof,
    publicSignals,
  };
}

async function sendPost(proof: any, publicSignals: any) {
  let curve = await buildBls12381();
  let proofProc = unstringifyBigInts(proof);
  var pi_aS = g1Compressed(curve, proofProc.pi_a);
  var pi_bS = g2Compressed(curve, proofProc.pi_b);
  var pi_cS = g1Compressed(curve, proofProc.pi_c);
  var pi_a = Buffer.from(pi_aS, "hex");
  var pi_b = Buffer.from(pi_bS, "hex");
  var pi_c = Buffer.from(pi_cS, "hex");

  // TODO: estimate gas
  console.log(
    publicSignals.slice(
      MAX_USER_LENGTH * 2,
      MAX_USER_LENGTH * 2 + MSG_PUBLIC_INPUT_SIZE
    )
  );

  // send post to the contract
  return GroupZk.createSendPost({
    pi_a: pi_a,
    pi_b: pi_b,
    pi_c: pi_c,
    pubInputs: publicSignals.slice(
      MAX_USER_LENGTH * 2,
      MAX_USER_LENGTH * 2 + MSG_PUBLIC_INPUT_SIZE
    ),
  });
}

export default function Bulletin({ metadata }: { metadata: BulletinMetadata }) {
  const [isBulletinLoading, setIsBulletinLoading] = useState<boolean>(true);
  const [bulletinUsers, setBulletinUsers] = useState<any[]>([]);
  const [bulletinMessages, setBulletinMessages] = useState<any[]>([]);
  const [privateKey, setPrivateKey] = useState<Buffer | undefined>(undefined);
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"init" | "joined" | "full" | "joining">(
    "init"
  );

  useEffect(() => {
    setIsBulletinLoading(true);
    setPrivateKey(undefined);
    setStatus("init");
  }, [metadata]);

  useEffect(() => {
    const handler = async () => {
      const eddsa = await buildEddsa();
      const babyJub = await buildBabyjub();

      const provider = await getTonProvider();
      if (provider) {
        const addressInfo = await provider.getAddressInfo(
          metadata.contractAddress
        );
        if (addressInfo && addressInfo.data) {
          const slice = BOC.from(addressInfo.data).root[0].slice();

          const _bulletinUsers = [];
          slice.loadUint(16);
          const usersLength = slice.loadUint(8);
          const usersDict = slice.loadDict(8);
          for (let i = 0; i < usersLength; i++) {
            const slice = usersDict.get(numberToBitArray(i, 8)).slice();
            const leftPart = slice.loadBigUint(256);
            const rightPart = slice.loadBigUint(256);
            const publicKey =
              leftPart
                .toString(2)
                .padStart(128, "0")
                .split("")
                .reverse()
                .join("") +
              rightPart
                .toString(2)
                .padStart(128, "0")
                .split("")
                .reverse()
                .join("");
            _bulletinUsers.push(publicKey);
          }
          setBulletinUsers(_bulletinUsers);

          // check whether the user is already in the group
          if (privateKey) {
            const { aBits } = _addUser(privateKey, eddsa, babyJub);
            if (_bulletinUsers.indexOf(aBits.join("")) !== -1) {
              setStatus("joined");
            }
          }

          const _bulletinMessages = [];
          const msgsLength = slice.loadUint(16);
          const msgs = slice.loadDict(16);
          for (let i = 0; i < msgsLength; i++) {
            const _cell = msgs.get(numberToBitArray(i, 16));
            const inputList = cell3ToInputList(_cell);
            _bulletinMessages.push(hexDecode(inputList.join("")));
          }
          setBulletinMessages(_bulletinMessages);

          setIsBulletinLoading(false);
        } else {
          console.error("failed to get address info");
        }
      } else {
        console.error("failed to get ton provider");
      }
    };
    handler();
    const intervalId = setInterval(handler, 5000);
    return () => clearInterval(intervalId);
  }, [metadata.contractAddress, privateKey, setBulletinMessages]);

  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  if (isBulletinLoading) {
    return <div>loading...</div>;
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div>Name: {metadata.name}</div>
      <div>Users: {bulletinUsers.length} / 10</div>
      {wallet && status === "init" ? (
        <div>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            onClick={async () => {
              const eddsa = await buildEddsa();
              const babyJub = await buildBabyjub();

              // get signature
              let signature = "";
              const payload = [
                {
                  data: hexEncode("Anonymous Bulletin"),
                },
              ];
              switch (wallet.appName) {
                case "openmask":
                  // @ts-ignore
                  signature = await window["openmask"].provider.send(
                    "ton_rawSign",
                    payload
                  );
                  break;
                case "mytonwallet":
                  // @ts-ignore
                  signature = await window["myTonWallet"].send(
                    "ton_rawSign",
                    payload
                  );
                  break;
                default:
                  break;
              }
              const _privateKey = Buffer.from(signature, "hex");
              setPrivateKey(_privateKey);

              // check whether the user is already in the group
              const { aBits } = _addUser(_privateKey, eddsa, babyJub);
              if (bulletinUsers.indexOf(aBits.join("")) !== -1) {
                setStatus("joined");
                return;
              }

              // check max user length
              if (bulletinUsers.length === MAX_USER_LENGTH) {
                setStatus("full");
                return;
              }

              // try to join the group
              await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 60, // 60 seconds
                messages: [
                  {
                    address: metadata.contractAddress,
                    amount: toNano("0.15").toString(10), // 0.15 TON for fee
                    payload: sendAddUser(_privateKey, eddsa, babyJub)
                      .toBoc()
                      .toString("base64"),
                  },
                ],
              });
              setStatus("joining");

              // TODO: check status
            }}
          >
            JOIN
          </button>
        </div>
      ) : null}
      {status === "full" ? (
        <div>
          <button className="bg-gray-500 text-white font-bold py-2 px-4 rounded">
            FULL
          </button>
        </div>
      ) : null}
      {status === "joined" ? (
        <div className="flex flex-row space-x-4">
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            placeholder="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center">
            {getMessageBytesLength(message)} / {MAX_MSG_BITS_LENGTH / 8}
          </div>
          <button
            className="bg-yellow-500 hover:bg-yellow-700 disabled:bg-yellow-900 text-white font-bold py-2 px-4 rounded"
            onClick={async () => {
              if (privateKey) {
                const eddsa = await buildEddsa();
                const babyJub = await buildBabyjub();

                const msg = formatMsg(Buffer.from(hexEncode(message), "hex"));
                const { proof, publicSignals } = await generateProof(
                  msg,
                  privateKey,
                  bulletinUsers,
                  eddsa,
                  babyJub
                );
                await tonConnectUI.sendTransaction({
                  validUntil: Math.floor(Date.now() / 1000) + 60, // 60 seconds
                  messages: [
                    {
                      address: metadata.contractAddress,
                      amount: toNano("0.5").toString(10), // 0.5 TON for fee
                      payload: (await sendPost(proof, publicSignals))
                        .toBoc()
                        .toString("base64"),
                    },
                  ],
                });
                setMessage("");
              } else {
                console.error("private key not found");
              }
            }}
            disabled={
              !privateKey ||
              getMessageBytesLength(message) > MAX_MSG_BITS_LENGTH / 8 ||
              getMessageBytesLength(message) === 0
            }
          >
            SEND
          </button>
        </div>
      ) : null}
      <div className="flex flex-col space-y-2 w-full max-w-md p-4 bg-white border border-gray-200 rounded-lg shadow sm:p-8">
        {bulletinMessages.length === 0 ? "empty" : null}
        <div className="flow-root">
          <ul role="list" className="divide-y divide-gray-200">
            {bulletinMessages.map((b, index) => (
              <li key={index} className="py-3">
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
