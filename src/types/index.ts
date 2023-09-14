declare global {
  interface Window {
    snarkjs: any;
    LZString: any;
  }
}

export type BulletinMetadata = {
  name: string;
  contractAddress: string;
}
