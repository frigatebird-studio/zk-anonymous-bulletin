import { getCurveFromName, Scalar }  from "ffjavascript";

export default async function buildBabyJubBls() {
    const bls12381 = await getCurveFromName("BLS12381", true);
    return new BabyJubBls(bls12381.Fr);
}

class BabyJubBls {
    constructor(F) {
        this.F = F;
        this.p = Scalar.fromString("52435875175126190479447740508185965837690552500527637822603658699938581184513");
        this.pm1d2 = Scalar.div(Scalar.sub(this.p, Scalar.e(1)),  Scalar.e(2));

        this.Generator = [
            F.e("1965318942575126983110109341569076712429591563459123735984697159722542010829"),
            F.e("9533795486386580087172316456033811970489191363732297785927937945443378397185")
        ];
        this.Base8 = [
            F.e("42607188171447154923842790955173337509154282047444971005088220689793543366946"),
            F.e("36406494601202321599682920720967603831539525975050808752104175866812403427116")
        ];
        this.order = Scalar.fromString("52435875175126190479447740508185965837367692370111621492982066814308916994296");
        this.subOrder = Scalar.shiftRight(this.order, 3);
        this.A = F.e("344892");
        this.D = F.e("344888");
    }


    addPoint(a,b) {
        const F = this.F;

        const res = [];

        /* does the equivalent of:
        res[0] = bigInt((a[0]*b[1] + b[0]*a[1]) *  bigInt(bigInt("1") + d*a[0]*b[0]*a[1]*b[1]).inverse(q)).affine(q);
        res[1] = bigInt((a[1]*b[1] - cta*a[0]*b[0]) * bigInt(bigInt("1") - d*a[0]*b[0]*a[1]*b[1]).inverse(q)).affine(q);
        */

        const beta = F.mul(a[0],b[1]);
        const gamma = F.mul(a[1],b[0]);
        const delta = F.mul(
            F.sub(a[1], F.mul(this.A, a[0])),
            F.add(b[0], b[1])
        );
        const tau = F.mul(beta, gamma);
        const dtau = F.mul(this.D, tau);

        res[0] = F.div(
            F.add(beta, gamma),
            F.add(F.one, dtau)
        );

        res[1] = F.div(
            F.add(delta, F.sub(F.mul(this.A,beta), gamma)),
            F.sub(F.one, dtau)
        );

        return res;
    }

    mulPointEscalar(base, e) {
        const F = this.F;
        let res = [F.e("0"),F.e("1")];
        let rem = e;
        let exp = base;

        while (! Scalar.isZero(rem)) {
            if (Scalar.isOdd(rem)) {
                res = this.addPoint(res, exp);
            }
            exp = this.addPoint(exp, exp);
            rem = Scalar.shiftRight(rem, 1);
        }

        return res;
    }

    inSubgroup(P) {
        const F = this.F;
        if (!this.inCurve(P)) return false;
        const res= this.mulPointEscalar(P, this.subOrder);
        return (F.isZero(res[0]) && F.eq(res[1], F.one));
    }

    inCurve(P) {
        const F = this.F;
        const x2 = F.square(P[0]);
        const y2 = F.square(P[1]);

        if (!F.eq(
            F.add(F.mul(this.A, x2), y2),
            F.add(F.one, F.mul(F.mul(x2, y2), this.D)))) return false;

        return true;
    }

    packPoint(P) {
        const F = this.F;
        const buff = new Uint8Array(32);
        F.toRprLE(buff, 0, P[1]);
        const n = F.toObject(P[0]);
        if (Scalar.gt(n, this.pm1d2)) {
            buff[31] = buff[31] | 0x80;
        }
        return buff;
    }

    unpackPoint(buff) {
        const F = this.F;
        let sign = false;
        const P = new Array(2);
        if (buff[31] & 0x80) {
            sign = true;
            buff[31] = buff[31] & 0x7F;
        }
        P[1] = F.fromRprLE(buff, 0);
        if (Scalar.gt(F.toObject(P[1]), this.p)) return null;

        const y2 = F.square(P[1]);

        const x2 = F.div(
            F.sub(F.one, y2),
            F.sub(this.A, F.mul(this.D, y2))
        );

        const x2h = F.exp(x2, F.half);
        if (! F.eq(F.one, x2h)) return null;

        let x = F.sqrt(x2);

        if (x == null) return null;

        if (sign) x = F.neg(x);

        P[0] = x;

        return P;
    }
}
