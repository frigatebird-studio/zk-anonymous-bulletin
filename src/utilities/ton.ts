import { Cell } from "ton-core";
import {
  Builder as Builder3,
  Cell as Cell3,
  BOC as BOC3,
  Bit as Bit3,
} from "ton3-core";
import { num2Hex } from "./zk";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { DAPP_NETWORK } from "@/constants";
import TonWeb from "tonweb";

export function cell3ToInputList(cell: Cell3): string[] {
  const inputList: string[] = [];
  let slice = cell.slice();
  while (1) {
    const b = num2Hex(slice.loadBigUint(256).toString(10));
    inputList.push(b);
    if (slice.refs.length === 0) {
      break;
    }
    slice = slice.loadRef().slice();
  }
  return inputList;
}

export function cell3FromBigIntList(list: bigint[]): Cell3 {
  const builder = new Builder3();
  if (list.length > 0) {
    builder.storeUint(list[0], 256);
  }
  if (list.length > 1) {
    builder.storeRef(cell3FromBigIntList(list.slice(1)));
  }
  return builder.cell();
}

export const cell3ToCell = (cell: Cell3): Cell => {
  return Cell.fromBoc(Buffer.from(new BOC3([cell]).toString(), "hex"))[0];
};

export const cellToCell3 = (cell: Cell): Cell3 => {
  const cell3 = BOC3.from(cell.toBoc()).root[0];
  return cell3;
};

export const numberToBitArray = (n: number, length = 8): Bit3[] => {
  return [...n.toString(2).padStart(length, "0")].map((n) =>
    parseInt(n)
  ) as Bit3[];
};

export const bitArrayToNumber = (b: Bit3[]): number => {
  return parseInt(b.join(""), 2);
};

export async function getTonProvider() {
  try {
    const endpoint = await getHttpEndpoint({ network: DAPP_NETWORK });
    const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint));
    return tonweb.provider;
  } catch (e) {
    return undefined;
  }
}
