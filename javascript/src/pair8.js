/*
 * Copyright (c) 2012-2020 MIRACL UK Ltd.
 *
 * This file is part of MIRACL Core
 * (see https://github.com/miracl/core).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var PAIR8 = function(ctx) {
    "use strict";

    var PAIR8 = {
		dbl: function(A,AA,BB,CC) {
            CC.copy(A.getx());
            var YY = new ctx.FP8(A.gety());
            BB.copy(A.getz());
            AA.copy(YY);

            AA.mul(BB); //YZ
            CC.sqr(); //X^2
            YY.sqr(); //Y^2
            BB.sqr(); //Z^2


			AA.add(AA);
			AA.neg(); AA.norm();       //-2AA
			AA.times_i();

			var sb = 3 * ctx.ROM_CURVE.CURVE_B_I;
			BB.imul(sb);
			CC.imul(3);
			if (ctx.ECP.SEXTIC_TWIST==ctx.ECP.D_TYPE)
			{
				YY.times_i();
				CC.times_i();
			}
			if (ctx.ECP.SEXTIC_TWIST==ctx.ECP.M_TYPE)
			{
				BB.times_i();
			}
			BB.sub(YY);
			BB.norm();

			A.dbl();
		},

		add: function(A,B,AA,BB,CC) {
            AA.copy(A.getx()); // X1
            CC.copy(A.gety()); // Y1
            var T1 = new ctx.FP8(A.getz()); // Z1
            BB.copy(A.getz()); // Z1

            T1.mul(B.gety()); // T1=Z1.Y2
            BB.mul(B.getx()); // T2=Z1.X2

            AA.sub(BB);
            AA.norm(); // X1=X1-Z1.X2
            CC.sub(T1);
            CC.norm(); // Y1=Y1-Z1.Y2

            T1.copy(AA); // T1=X1-Z1.X2

            if (ctx.ECP.SEXTIC_TWIST == ctx.ECP.M_TYPE) {
                AA.times_i();
                AA.norm();
            }

            T1.mul(B.gety()); // T1=(X1-Z1.X2).Y2

            BB.copy(CC); // T2=Y1-Z1.Y2
            BB.mul(B.getx()); // T2=(Y1-Z1.Y2).X2
            BB.sub(T1);
            BB.norm(); // T2=(Y1-Z1.Y2).X2 - (X1-Z1.X2).Y2
            CC.neg();
            CC.norm(); // Y1=-(Y1-Z1.Y2).Xs

            A.add(B);
		},


        /* Line function */
        line: function(A, B, Qx, Qy) {
            var r = new ctx.FP48(1);

			var a,b,c;
			var AA=new ctx.FP8(0);
			var BB=new ctx.FP8(0);
			var CC=new ctx.FP8(0);
            if (A == B) 
				PAIR8.dbl(A,AA,BB,CC);
			else
				PAIR8.add(A,B,AA,BB,CC);

			CC.tmul(Qx);
			AA.tmul(Qy);

            a = new ctx.FP16(AA, BB); 
            if (ctx.ECP.SEXTIC_TWIST == ctx.ECP.D_TYPE) {
                b = new ctx.FP16(CC); // L(0,1) | L(0,0) | L(1,0)
                c = new ctx.FP16(0);
            }
            if (ctx.ECP.SEXTIC_TWIST == ctx.ECP.M_TYPE) {
                b = new ctx.FP16(0);
                c = new ctx.FP16(CC); c.times_i();
            }

            r.set(a, b, c);
			r.settype(ctx.FP.SPARSER);

            return r;
        },


/* prepare for multi-pairing */
		initmp: function() {
			var r=[];
			for (var i=0;i<ctx.ECP.ATE_BITS;i++)
				r[i] = new ctx.FP48(1);
			return r;
		},

/* basic Miller loop */
		miller: function(r) {
			var res=new ctx.FP48(1);
			for (var i=ctx.ECP.ATE_BITS-1; i>=1; i--)
			{
				res.sqr();
				res.ssmul(r[i]); 
				r[i].zero();
			}

			if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX)
				res.conj();
			res.ssmul(r[0]);
			r[0].zero();

			return res;
		},

// Store precomputed line details in an FP8
		pack: function(AA,BB,CC) {
			var i=new ctx.FP8(CC);
			i.inverse(null);
			var a=new ctx.FP8(AA);
			a.mul(i);
			var b=new ctx.FP8(BB);
			b.mul(i);
			return new ctx.FP16(a,b);
		},

		unpack: function(T,Qx,Qy) {
			var a,b,c;
			a=new ctx.FP16(T);
			a.geta().tmul(Qy);
			var t=new ctx.FP8(Qx);
            if (ctx.ECP.SEXTIC_TWIST == ctx.ECP.D_TYPE) {
				b=new ctx.FP16(t);
				c=new ctx.FP16(0);

			}
			if (ctx.ECP.SEXTIC_TWIST == ctx.ECP.M_TYPE) {
				b=new ctx.FP16(0);
				c=new ctx.FP16(t); c.times_i();
			}
			var v=new ctx.FP48(a,b,c);
			v.settype(ctx.FP.SPARSEST);
			return v;
		},

		precomp : function(QV) {
			var n=new ctx.BIG(0);
			var n3=new ctx.BIG(0);
			var nb=PAIR8.lbits(n3,n);
			var P=new ctx.ECP8(); P.copy(QV);
			var AA=new ctx.FP8(0);
			var BB=new ctx.FP8(0);
			var CC=new ctx.FP8(0);
			var j,bt;

			var A=new ctx.ECP8();
			A.copy(P);
			var MP=new ctx.ECP8();
			MP.copy(P); MP.neg();
			j=0;

			var T=[];
			for (var i=nb-2;i>=1;i--)
			{
				PAIR8.dbl(A,AA,BB,CC);
				T[j++]=PAIR8.pack(AA,BB,CC);

				bt=n3.bit(i)-n.bit(i); 
				if (bt==1)
				{
					PAIR8.add(A,P,AA,BB,CC);
					T[j++]=PAIR8.pack(AA,BB,CC);
				}
				if (bt==-1)
				{
					PAIR8.add(A,MP,AA,BB,CC);
					T[j++]=PAIR8.pack(AA,BB,CC);
				}
			}
			return T;
		},

/* Accumulate another set of line functions for n-pairing, assuming precomputation on G2 */
		another_pc(r,T,QV) {
			var n=new ctx.BIG(0);
			var n3=new ctx.BIG(0);
			var nb=PAIR8.lbits(n3,n);
			var lv,lv2;
			var j,bt;

			if (QV.is_infinity()) return;

			var Q=new ctx.ECP(); Q.copy(QV); Q.affine();
			var Qx=new ctx.FP(Q.getx());
			var Qy=new ctx.FP(Q.gety());

			j=0;
			for (var i=nb-2;i>=1;i--)
			{
				lv=PAIR8.unpack(T[j++],Qx,Qy);
				bt=n3.bit(i)-n.bit(i); 
				if (bt==1)
				{
					lv2=PAIR8.unpack(T[j++],Qx,Qy);
					lv.smul(lv2);
				}
				if (bt==-1)
				{
					lv2=PAIR8.unpack(T[j++],Qx,Qy);
					lv.smul(lv2);
				}
				r[i].ssmul(lv);
			}
		},


/* Accumulate another set of line functions for n-pairing */
		another: function(r,P1,Q1) {
			var n=new ctx.BIG(0);
			var n3=new ctx.BIG(0);
			var lv,lv2;
			var bt;

			if (Q1.is_infinity()) return;
// P is needed in affine form for line function, Q for (Qx,Qy) extraction
			var P=new ctx.ECP8(); P.copy(P1); P.affine();
			var Q=new ctx.ECP(); Q.copy(Q1); Q.affine();

			P.affine();
			Q.affine();

			var Qx=new ctx.FP(Q.getx());
			var Qy=new ctx.FP(Q.gety());

			var A=new ctx.ECP8();
			A.copy(P);

			var MP=new ctx.ECP8();
			MP.copy(P); MP.neg();

			var nb=PAIR8.lbits(n3,n);

			for (var i=nb-2;i>=1;i--)
			{
				lv=PAIR8.line(A,A,Qx,Qy);

				bt=n3.bit(i)-n.bit(i); 
				if (bt==1)
				{
					lv2=PAIR8.line(A,P,Qx,Qy);
					lv.smul(lv2);
				}
				if (bt==-1)
				{
					lv2=PAIR8.line(A,MP,Qx,Qy);
					lv.smul(lv2);
				}
				r[i].ssmul(lv);
			} 
		},


        /* Optimal R-ate pairing */
        ate: function(P1, Q1) {
            var n, n3, lv, lv2,
                Qx, Qy, A, NP, r, nb, bt,
                i;

			if (Q1.is_infinity()) return new ctx.FP48(1);
            n = new ctx.BIG(0);
			n3 = new ctx.BIG(0);

			var P=new ctx.ECP8(); P.copy(P1); P.affine();
			var Q=new ctx.ECP(); Q.copy(Q1); Q.affine();

            Qx = new ctx.FP(Q.getx()); 
            Qy = new ctx.FP(Q.gety()); 

            A = new ctx.ECP8();
            r = new ctx.FP48(1);

            A.copy(P);
			NP = new ctx.ECP8();
			NP.copy(P);
			NP.neg();


            nb = PAIR8.lbits(n3,n);

            for (i = nb - 2; i >= 1; i--) {
                r.sqr();
                lv = PAIR8.line(A, A, Qx, Qy);
                bt=n3.bit(i)-n.bit(i);

                if (bt == 1) {
                    lv2 = PAIR8.line(A, P, Qx, Qy);
                    lv.smul(lv2);
                }
                if (bt == -1) {
                    lv2 = PAIR8.line(A, NP, Qx, Qy);
                    lv.smul(lv2);
                }
                r.ssmul(lv);
            }

            if (ctx.ECP.SIGN_OF_X == ctx.ECP.NEGATIVEX) {
                r.conj();
            }

            return r;
        },

        /* Optimal R-ate double pairing e(P,Q).e(R,S) */
        ate2: function(P1, Q1, R1, S1) {
            var n, n3, lv, lv2,
                Qx, Qy, Sx, Sy, A, B, NP, NR, r, nb, bt,
                i;

			if (Q1.is_infinity()) return PAIR8.ate(R1,S1);
			if (S1.is_infinity()) return PAIR8.ate(P1,Q1);

            n = new ctx.BIG(0);
			n3 = new ctx.BIG(0);

			var P=new ctx.ECP8(); P.copy(P1); P.affine();
			var Q=new ctx.ECP(); Q.copy(Q1); Q.affine();
			var R=new ctx.ECP8(); R.copy(R1); R.affine();
			var S=new ctx.ECP(); S.copy(S1); S.affine();


            Qx = new ctx.FP(Q.getx()); 
            Qy = new ctx.FP(Q.gety()); 

            Sx = new ctx.FP(S.getx()); 
            Sy = new ctx.FP(S.gety()); 

            A = new ctx.ECP8();
            B = new ctx.ECP8();
            r = new ctx.FP48(1);

            A.copy(P);
            B.copy(R);
			NP = new ctx.ECP8();
			NP.copy(P);
			NP.neg();
			NR = new ctx.ECP8();
			NR.copy(R);
			NR.neg();


            nb = PAIR8.lbits(n3,n);

            for (i = nb - 2; i >= 1; i--) {
                r.sqr();
                lv = PAIR8.line(A, A, Qx, Qy);
                lv2 = PAIR8.line(B, B, Sx, Sy);
				lv.smul(lv2);
                r.ssmul(lv);

                bt=n3.bit(i)-n.bit(i);

                if (bt == 1) {
                    lv = PAIR8.line(A, P, Qx, Qy);
                    lv2 = PAIR8.line(B, R, Sx, Sy);
					lv.smul(lv2);
                    r.ssmul(lv);
                }
                if (bt == -1) {
                    lv = PAIR8.line(A, NP, Qx, Qy);
                    lv2 = PAIR8.line(B, NR, Sx, Sy);
					lv.smul(lv2);
                    r.ssmul(lv);
                }
            }

            if (ctx.ECP.SIGN_OF_X == ctx.ECP.NEGATIVEX) {
                r.conj();
            }

            return r;
        },

        /* final exponentiation - keep separate for multi-pairings and to avoid thrashing stack */
        fexp: function(m) {
            var fa, fb, f, x, r, lv;
            //    t1,t2,t3,t7;

            fa = new ctx.BIG(0);
            fa.rcopy(ctx.ROM_FIELD.Fra);
            fb = new ctx.BIG(0);
            fb.rcopy(ctx.ROM_FIELD.Frb);
            f = new ctx.FP2(fa, fb);
            x = new ctx.BIG(0);
            x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);

            r = new ctx.FP48(m); //r.copy(m);

            /* Easy part of final exp */
            lv = new ctx.FP48(r); //lv.copy(r);
            lv.inverse();
            r.conj();
            r.mul(lv);
            lv.copy(r);
            r.frob(f,8);
            r.mul(lv);

            /* Hard part of final exp */

// See https://eprint.iacr.org/2020/875.pdf
            var t0,y0,y1;
            y1=new ctx.FP48(r);
            y1.usqr();
            y1.mul(r); // y1=r^3

            y0=new ctx.FP48(r.pow(x));
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                y0.conj();
            }
            t0=new ctx.FP48(r); t0.conj();
            r.copy(y0);
            r.mul(t0);

            y0.copy(r.pow(x));
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
               y0.conj();
            }
            t0.copy(r); t0.conj();
         r.copy(y0);
            r.mul(t0);

// ^(x+p)
            y0.copy(r.pow(x));
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                y0.conj();
            }
            t0.copy(r);
            t0.frob(f,1);
            r.copy(y0);
            r.mul(t0);

// ^(x^2+p^2)
            y0.copy(r.pow(x));
            y0.copy(y0.pow(x));
            t0.copy(r);
            t0.frob(f,2);
            r.copy(y0);
            r.mul(t0);

// ^(x^4+p^4)
            y0.copy(r.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            t0.copy(r);
            t0.frob(f,4);
            r.copy(y0);
            r.mul(t0);

// ^(x^8+p^8-1)
            y0.copy(r.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            y0.copy(y0.pow(x));
            t0.copy(r);
            t0.frob(f,8);
            y0.mul(t0);
            t0.copy(r); t0.conj();
            r.copy(y0);
            r.mul(t0);

            r.mul(y1);
            r.reduce();      

/*
            // Ghamman & Fouotsa Method
            t7=new ctx.FP48(r); t7.usqr();

			if (x.parity()==1)
			{
				t2=r.pow(x);
				t1=new ctx.FP48(t2); t1.usqr();
				t2=t2.pow(x);
			} else {
				t1=t7.pow(x);
				x.fshr(1);
				t2=t1.pow(x);
				x.fshl(1);
			}
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3=new ctx.FP48(t1); t3.conj();
            t2.mul(t3);
            t2.mul(r);

            r.mul(t7);

            t1=t2.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }
            t3.copy(t1);
            t3.frob(f,14);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,13);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,12);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,11);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,10);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,9);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,8);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t2); t3.conj();
            t1.mul(t3);
            t3.copy(t1);
            t3.frob(f,7);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,6);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,5);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,4);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,3);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,2);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            t3.copy(t1);
            t3.frob(f,1);
            r.mul(t3);
            t1=t1.pow(x);
            if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
                t1.conj();
            }

            r.mul(t1);
            t2.frob(f,15);
            r.mul(t2);

            r.reduce();
*/
            return r;
        }
    };

/* prepare ate parameter, n=6u+2 (BN) or n=u (BLS), n3=3*n */
	PAIR8.lbits = function(n3,n)
	{
		n.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
		n3.copy(n);
		n3.pmul(3);
		n3.norm();
		return n3.nbits();
	};

    /* GLV method */
    PAIR8.glv = function(ee) {
        var u = [],
            q, x, x2, ee, bd;

        // -(x^2).P = (Beta.x,y)
        q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        x = new ctx.BIG(0);
        x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
        x2 = ctx.BIG.smul(x, x);
        x = ctx.BIG.smul(x2,x2);
        x2 = ctx.BIG.smul(x,x);
        bd = q.nbits()-x2.nbits();
        u[0] = new ctx.BIG(ee);
        u[0].ctmod(x2,bd);
        u[1] = new ctx.BIG(ee);
        u[1].ctdiv(x2,bd);
        u[1].rsub(q);

        return u;
    };

    /* Galbraith & Scott Method */
    PAIR8.gs = function(ee) {
        var u = [],
            i, q, x, w, ee, bd;

        x = new ctx.BIG(0);
        x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
        q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        bd = q.nbits()-x.nbits();
        w = new ctx.BIG(ee);

        for (i = 0; i < 15; i++) {
            u[i] = new ctx.BIG(w);
            u[i].ctmod(x,bd);
            w.ctdiv(x,bd);
        }

        u[15] = new ctx.BIG(w);
        if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
            u[1].copy(ctx.BIG.modneg(u[1], q));
            u[3].copy(ctx.BIG.modneg(u[3], q));
            u[5].copy(ctx.BIG.modneg(u[5], q));
            u[7].copy(ctx.BIG.modneg(u[7], q));
            u[9].copy(ctx.BIG.modneg(u[9],q));
            u[11].copy(ctx.BIG.modneg(u[11],q));
            u[13].copy(ctx.BIG.modneg(u[13],q));
            u[15].copy(ctx.BIG.modneg(u[15],q));

        }

        return u;
    };

    /* Multiply P by e in group G1 */
    PAIR8.G1mul = function(P, e) {
        var R, Q, q, bcru, cru, t, u, np, nn, ee;
        q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        ee = new ctx.BIG(0); ee.copy(e); ee.mod(q);
        if (ctx.ROM_CURVE.USE_GLV) {
            R = new ctx.ECP();
            R.copy(P);
            Q = new ctx.ECP();
            Q.copy(P); Q.affine();
            bcru = new ctx.BIG(0);
            bcru.rcopy(ctx.ROM_FIELD.CRu);
            cru = new ctx.FP(bcru);
            t = new ctx.BIG(0);
            u = PAIR8.glv(ee);

            Q.getx().mul(cru);

            np = u[0].nbits();
            t.copy(ctx.BIG.modneg(u[0], q));
            nn = t.nbits();
            if (nn < np) {
                u[0].copy(t);
                R.neg();
            }

            np = u[1].nbits();
            t.copy(ctx.BIG.modneg(u[1], q));
            nn = t.nbits();
            if (nn < np) {
                u[1].copy(t);
                Q.neg();
            }
            u[0].norm();
            u[1].norm();
            R = R.mul2(u[0], Q, u[1]);
        } else {
            R = P.clmul(ee,q);
        }

        return R;
    };

    /* Multiply P by e in group G2 */
    PAIR8.G2mul = function(P, e) {
        var R, Q, F, q, u, t, i, np, nn, ee;
        q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        ee = new ctx.BIG(0); ee.copy(e); ee.mod(q);
        if (ctx.ROM_CURVE.USE_GS_G2) {
            Q = [];
            F = ctx.ECP8.frob_constants();

            u = PAIR8.gs(ee);
            t = new ctx.BIG(0);
          
            Q[0] = new ctx.ECP8();
            Q[0].copy(P);

            for (i = 1; i < 16; i++) {
                Q[i] = new ctx.ECP8();
                Q[i].copy(Q[i - 1]);
                Q[i].frob(F,1);
            }

            for (i = 0; i < 16; i++) {
                np = u[i].nbits();
                t.copy(ctx.BIG.modneg(u[i], q));
                nn = t.nbits();

                if (nn < np) {
                    u[i].copy(t);
                    Q[i].neg();
                }
                u[i].norm();
            }

            R = ctx.ECP8.mul16(Q, u);
        } else {
            R = P.mul(ee);
        }
        return R;
    };

    /* Note that this method requires a lot of RAM!  */
    PAIR8.GTpow = function(d, e) {
        var r, g, fa, fb, f, q, t, u, i, np, nn, ee;
        q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        ee = new ctx.BIG(0); ee.copy(e); ee.mod(q);
        if (ctx.ROM_CURVE.USE_GS_GT) {
            g = [];
            fa = new ctx.BIG(0);
            fa.rcopy(ctx.ROM_FIELD.Fra);
            fb = new ctx.BIG(0);
            fb.rcopy(ctx.ROM_FIELD.Frb);
            f = new ctx.FP2(fa, fb);

            t = new ctx.BIG(0);
            u = PAIR8.gs(ee);

            g[0] = new ctx.FP48(d);

            for (i = 1; i < 16; i++) {
                g[i] = new ctx.FP48(0);
                g[i].copy(g[i - 1]);
                g[i].frob(f,1);
            }

            for (i = 0; i < 16; i++) {
                np = u[i].nbits();
                t.copy(ctx.BIG.modneg(u[i], q));
                nn = t.nbits();

                if (nn < np) {
                    u[i].copy(t);
                    g[i].conj();
                }
                u[i].norm();
            }

            r = ctx.FP48.pow16(g, u);
        } else {
            r = d.pow(ee);
        }

        return r;
    };

/* test G1 group membership */
    PAIR8.G1member=function(P)
    {
        var x = new ctx.BIG(0);
        x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
        var bcru = new ctx.BIG(0);
        bcru.rcopy(ctx.ROM_FIELD.CRu);
        var cru = new ctx.FP(bcru);
        var W=new ctx.ECP(); W.copy(P);
        var T=P.mul(x);  
        if (P.equals(T)) return false;    // P is of low order             
        T=T.mul(x); T=T.mul(x); T=T.mul(x); T=T.mul(x); T=T.mul(x); T=T.mul(x); T=T.mul(x); T.neg();
        W.getx().mul(cru);
        if (!W.equals(T)) return false;
 
 // Not needed
 //       W.add(P);
 //       T.getx().mul(cru);
 //       W.add(T);
 //       if (!W.is_infinity()) return false;
/*
        var q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        if (P.is_infinity()) return false;
        var W=P.mul(q);
        if (!W.is_infinity()) return false; */
        return true;
    };
/* test G2 group membership */
    PAIR8.G2member=function(P)
    {
        var F = ctx.ECP8.frob_constants();
        var x = new ctx.BIG(0);
        x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
        var W=new ctx.ECP8(); W.copy(P); W.frob(F,1);
        var T=P.mul(x);
        if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
            T.neg();
        }
/*
        var R=new ctx.ECP8(); R.copy(W);
        R.frob(F,1);
        W.sub(R);
        R.copy(T);
        R.frob(F,1);
        W.add(R);
*/
        if (W.equals(T))
            return true;
        return false;
/*
        var q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        if (P.is_infinity()) return false;
        var W=P.mul(q);
        if (!W.is_infinity()) return false;
        return true; */
    };

/* Check that m is in cyclotomic sub-group */
/* Check that m!=1, conj(m)*m==1, and m.m^{p^16}=m^{p^8} */
    PAIR8.GTcyclotomic= function(m)
    {
        if (m.isunity()) return false;
        var r=new ctx.FP48(m);
        r.conj();
        r.mul(m);
        if (!r.isunity()) return false;

        var fa=new ctx.BIG(0); fa.rcopy(ctx.ROM_FIELD.Fra);
        var fb=new ctx.BIG(0); fb.rcopy(ctx.ROM_FIELD.Frb);
        var f=new ctx.FP2(fa,fb); 

        r.copy(m); r.frob(f,8); 
        var w=new ctx.FP48(r); w.frob(f,8); 
        w.mul(m);
        if (!w.equals(r)) return false;
        return true;
    };
/* test for full GT group membership */
    PAIR8.GTmember= function(m)
    {
        if (!PAIR8.GTcyclotomic(m)) return false;
        var fa=new ctx.BIG(0); fa.rcopy(ctx.ROM_FIELD.Fra);
        var fb=new ctx.BIG(0); fb.rcopy(ctx.ROM_FIELD.Frb);
        var f=new ctx.FP2(fa,fb); 
        var x = new ctx.BIG(0);
        x.rcopy(ctx.ROM_CURVE.CURVE_Bnx);
        var r=new ctx.FP48(m); r.frob(f,1);
        var t=m.pow(x);
        if (ctx.ECP.SIGN_OF_X==ctx.ECP.NEGATIVEX) {
            t.conj();
        }
        if (r.equals(t))
            return true;
        return false;

/*
        var q = new ctx.BIG(0);
        q.rcopy(ctx.ROM_CURVE.CURVE_Order);
        var r=m.pow(q);
        if (!r.isunity()) return false;
        return true; */
    };


    return PAIR8;
};

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports.PAIR8 = PAIR8;
}

