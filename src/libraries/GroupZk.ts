import { cell3FromBigIntList, cell3ToCell } from "@/utilities/ton";
import {
  Address,
  beginCell,
  Cell,
  Contract,
} from "ton-core";

export const Opcodes = {
  addUser: 0x2f032e88,
  post: 0xb53f8a28,
};

export type GroupZkConfig = {};

export function groupZkConfigToCell(config: GroupZkConfig): Cell {
  return beginCell().endCell();
}

export class GroupZk implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createAddUserPayload(opts: { pubInputs: bigint[]; queryID?: number }) {
    return beginCell()
      .storeUint(Opcodes.addUser, 32)
      .storeUint(opts.queryID ?? 0, 64)
      .storeRef(cell3ToCell(cell3FromBigIntList(opts.pubInputs)))
      .endCell();
  }

  static createSendPost(opts: {
    pi_a: Buffer;
    pi_b: Buffer;
    pi_c: Buffer;
    pubInputs: bigint[];
    queryID?: number;
  }) {
    return beginCell()
      .storeUint(Opcodes.post, 32)
      .storeUint(opts.queryID ?? 0, 64)
      .storeRef(
        beginCell()
          .storeBuffer(opts.pi_a)
          .storeRef(
            beginCell()
              .storeBuffer(opts.pi_b)
              .storeRef(
                beginCell()
                  .storeBuffer(opts.pi_c)
                  .storeRef(cell3ToCell(cell3FromBigIntList(opts.pubInputs)))
              )
          )
      )
      .endCell();
  }
}
