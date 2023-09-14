import { Scalar } from "ffjavascript";
import buildBabyJubBls from "./babyjub_bls.js";
import buildPedersenHashBls from "./pedersen_hash_bls.js";
import createBlakeHash from "blake-hash";

export default async function buildEddsaBls() {
    const babyJub = await buildBabyJubBls("bls12381");
    const pedersenHash = await buildPedersenHashBls();
    return new Eddsa(babyJub, pedersenHash);
}

class Eddsa {

    constructor(babyJub, pedersenHash) {
        this.babyJub = babyJub;
        this.pedersenHash = pedersenHash;
        this.F = babyJub.F;
    }

    pruneBuffer(buff) {
        buff[0] = buff[0] & 0xF8;
        buff[31] = buff[31] & 0x7F;
        buff[31] = buff[31] | 0x40;
        return buff;
    }

    prv2pub(prv) {
        const F = this.babyJub.F;
        const sBuff = this.pruneBuffer(createBlakeHash("blake512").update(Buffer.from(prv)).digest());
        let s = Scalar.fromRprLE(sBuff, 0, 32);
        const A = this.babyJub.mulPointEscalar(this.babyJub.Base8, Scalar.shr(s,3));
        return A;
    }

    signPedersen(prv, msg) {
        const F = this.babyJub.F;
        const sBuff = this.pruneBuffer(createBlakeHash("blake512").update(Buffer.from(prv)).digest());
        const s = Scalar.fromRprLE(sBuff, 0, 32);
        const A = this.babyJub.mulPointEscalar(this.babyJub.Base8, Scalar.shr(s, 3));

        const composeBuff = new Uint8Array(32 + msg.length);
        composeBuff.set(sBuff.slice(32), 0);
        composeBuff.set(msg, 32);
        const rBuff = createBlakeHash("blake512").update(Buffer.from(composeBuff)).digest();
        let r = Scalar.mod(Scalar.fromRprLE(rBuff, 0, 64), this.babyJub.subOrder);
        const R8 = this.babyJub.mulPointEscalar(this.babyJub.Base8, r);
        const R8p = this.babyJub.packPoint(R8);
        const Ap = this.babyJub.packPoint(A);

        const composeBuff2 = new Uint8Array(64 + msg.length);
        composeBuff2.set(R8p, 0);
        composeBuff2.set(Ap, 32);
        composeBuff2.set(msg, 64);

        const hmBuff = this.pedersenHash.hash(composeBuff2);
        const hm = Scalar.fromRprLE(hmBuff, 0, 32);

        const S = Scalar.mod(
            Scalar.add(
                r,
                Scalar.mul(hm, s)
            ),
            this.babyJub.subOrder
        )
        return {
            R8: R8,
            S: S
        };
    }

    verifyPedersen(msg, sig, A) {
        // Check parameters
        if (typeof sig != "object") return false;
        if (!Array.isArray(sig.R8)) return false;
        if (sig.R8.length!= 2) return false;
        if (!this.babyJub.inCurve(sig.R8)) return false;
        if (!Array.isArray(A)) return false;
        if (A.length!= 2) return false;
        if (!this.babyJub.inCurve(A)) return false;
        if (Scalar.geq(sig.S, this.babyJub.subOrder)) return false;

        const R8p = this.babyJub.packPoint(sig.R8);
        const Ap = this.babyJub.packPoint(A);


        const composeBuff2 = new Uint8Array(64 + msg.length);
        composeBuff2.set(R8p, 0);
        composeBuff2.set(Ap, 32);
        composeBuff2.set(msg, 64);


        const hmBuff = this.pedersenHash.hash(composeBuff2);
        const hm = Scalar.fromRprLE(hmBuff, 0, 32);

        const Pleft = this.babyJub.mulPointEscalar(this.babyJub.Base8, sig.S);
        let Pright = this.babyJub.mulPointEscalar(A, Scalar.mul(hm,8));
        Pright = this.babyJub.addPoint(sig.R8, Pright);

        if (!this.babyJub.F.eq(Pleft[0],Pright[0])) return false;
        if (!this.babyJub.F.eq(Pleft[1],Pright[1])) return false;
        return true;
    }

    packSignature(sig) {
        const buff = new Uint8Array(64);
        const R8p = this.babyJub.packPoint(sig.R8);
        buff.set(R8p, 0)
        const Sp = Scalar.toRprLE(buff, 32, sig.S, 32);
        return buff;
    }

    unpackSignature(sigBuff) {
        return {
            R8: this.babyJub.unpackPoint(sigBuff.slice(0,32)),
            S: Scalar.fromRprLE(sigBuff, 32, 32)
        };
    }
}


