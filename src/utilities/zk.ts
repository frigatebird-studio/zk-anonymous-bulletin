export function buffer2Bits(buff: Buffer) {
  const res: BigInt[] = [];
  for (let i = 0; i < buff.length; i++) {
    for (let j = 0; j < 8; j++) {
      if ((buff[i] >> j) & 1) {
        res.push(BigInt("1"));
      } else {
        res.push(BigInt("0"));
      }
    }
  }
  return res;
}

export function num2Hex(num: string) {
  if (num === "0") {
    return "";
  }
  const _ = BigInt(num).toString(16);
  const _padStart = _.length % 2 ? "0" : "";
  return _padStart
    .concat(_)
    .match(/.{1,2}/g)!
    .reverse()
    .join("");
}

export function splitBits2Nums(bits: any[]) {
  const bits0 = bits.slice(0, 128);
  const bits1 = bits.slice(128, 256);
  const num0 = BigInt("0b" + bits0.reverse().join(""));
  const num1 = BigInt("0b" + bits1.reverse().join(""));
  return [num0, num1];
}

export function bytes2Hex(bytes: Uint8Array) {
  return bytes.reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    ""
  );
}

export function g1Compressed(curve: any, p1Raw: any) {
  let p1 = curve.G1.fromObject(p1Raw);

  let buff = new Uint8Array(48);
  curve.G1.toRprCompressed(buff, 0, p1);
  // convert from ffjavascript to blst format
  if (buff[0] & 0x80) {
    buff[0] |= 32;
  }
  buff[0] |= 0x80;
  return bytes2Hex(buff);
}

export function g2Compressed(curve: any, p2Raw: any) {
  let p2 = curve.G2.fromObject(p2Raw);

  let buff = new Uint8Array(96);
  curve.G2.toRprCompressed(buff, 0, p2);
  // convert from ffjavascript to blst format
  if (buff[0] & 0x80) {
    buff[0] |= 32;
  }
  buff[0] |= 0x80;
  return bytes2Hex(buff);
}
