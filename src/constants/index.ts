import { BulletinMetadata } from "@/types";

export const DAPP_NETWORK = "testnet";
export const DAPP_BULLETIN_LIST: BulletinMetadata[] = [
  {
    name: "Bulletin 1",
    contractAddress: "EQDhkheAxfWJuqjAGiTVJ2VoPpYA6PC_WvqkN_yELola3Rvc",
  },
  {
    name: "Bulletin 2",
    contractAddress: "EQDm_ZvEMAeHj5ismG5hEpgyeZAs0wuEgbBdMwuwfRSA2xWl",
  },
  {
    name: "Bulletin 3",
    contractAddress: "EQBKckGO8lsJk4ua9Z7CTM6uNv78x9AyIMZrDK0DT6F6FVJN",
  },
];
export const MAX_USER_LENGTH = 10;
export const MSG_PUBLIC_INPUT_SIZE = 10;
export const MAX_MSG_BITS_LENGTH = 128 * MSG_PUBLIC_INPUT_SIZE;
