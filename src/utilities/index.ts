export function buffer2bits(buff: Buffer) {
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
