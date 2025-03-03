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

/* Kyber API implementation. Constant time where it matters. Spends nearly all of its time running SHA3. Small.

   M.Scott 22/11/2021
*/

#include "kyber.h"

using namespace core;

/* Start of public domain reference implementation code - taken from https://github.com/pq-crystals/kyber */

const sign16 zetas[128] = {
  -1044,  -758,  -359, -1517,  1493,  1422,   287,   202,
   -171,   622,  1577,   182,   962, -1202, -1474,  1468,
    573, -1325,   264,   383,  -829,  1458, -1602,  -130,
   -681,  1017,   732,   608, -1542,   411,  -205, -1571,
   1223,   652,  -552,  1015, -1293,  1491,  -282, -1544,
    516,    -8,  -320,  -666, -1618, -1162,   126,  1469,
   -853,   -90,  -271,   830,   107, -1421,  -247,  -951,
   -398,   961, -1508,  -725,   448, -1065,   677, -1275,
  -1103,   430,   555,   843, -1251,   871,  1550,   105,
    422,   587,   177,  -235,  -291,  -460,  1574,  1653,
   -246,   778,  1159,  -147,  -777,  1483,  -602,  1119,
  -1590,   644,  -872,   349,   418,   329,  -156,   -75,
    817,  1097,   603,   610,  1322, -1285, -1465,   384,
  -1215,  -136,  1218, -1335,  -874,   220, -1187, -1659,
  -1185, -1530, -1278,   794, -1510,  -854,  -870,   478,
   -108,  -308,   996,   991,   958, -1460,  1522,  1628
};

static int16_t montgomery_reduce(int32_t a)
{
  int16_t t;

  t = (int16_t)a*KY_QINV;
  t = (a - (int32_t)t*KY_PRIME) >> 16;
  return t;
}

static int16_t barrett_reduce(int16_t a) {
  int16_t t;
  const int16_t v = ((1<<26) + KY_PRIME/2)/KY_PRIME;

  t  = ((int32_t)v*a + (1<<25)) >> 26;
  t *= KY_PRIME;
  return a - t;
}

static sign16 fqmul(sign16 a, sign16 b) {
  return montgomery_reduce((sign32)a*b);
}

static void ntt(int16_t r[256]) {
  unsigned int len, start, j, k;
  int16_t t, zeta;

  k = 1;
  for(len = 128; len >= 2; len >>= 1) {
    for(start = 0; start < 256; start = j + len) {
      zeta = zetas[k++];
      for(j = start; j < start + len; j++) {
        t = fqmul(zeta, r[j + len]);
        r[j + len] = r[j] - t;
        r[j] = r[j] + t;
      }
    }
  }
}

static void invntt(int16_t r[256]) {
  unsigned int start, len, j, k;
  int16_t t, zeta;
  const int16_t f = 1441; // mont^2/128

  k = 127;
  for(len = 2; len <= 128; len <<= 1) {
    for(start = 0; start < 256; start = j + len) {
      zeta = zetas[k--];
      for(j = start; j < start + len; j++) {
        t = r[j];
        r[j] = barrett_reduce(t + r[j + len]);
        r[j + len] = r[j + len] - t;
        r[j + len] = fqmul(zeta, r[j + len]);
      }
    }
  }

  for(j = 0; j < 256; j++)
    r[j] = fqmul(r[j], f);
}

static void basemul(sign16 r[2], const sign16 a[2], const sign16 b[2], sign16 zeta) {
    r[0]  = fqmul(a[1], b[1]);
    r[0]  = fqmul(r[0], zeta);
    r[0] += fqmul(a[0], b[0]);
    r[1]  = fqmul(a[0], b[1]);
    r[1] += fqmul(a[1], b[0]);
}

static void poly_reduce(sign16 *r)
{
    int i;
    for(i=0;i<KY_DEGREE;i++)
        r[i] = barrett_reduce(r[i]);
}

static void poly_ntt(sign16 *r)
{
    ntt(r);
    poly_reduce(r);
}

static void poly_invntt(sign16 *r)
{
    invntt(r);
}

// Note r must be distinct from a and b
static void poly_mul(sign16 *r, const sign16 *a, const sign16 *b)
{
    int i;
    for(i = 0; i < KY_DEGREE/4; i++) {
        basemul(&r[4*i], &a[4*i], &b[4*i], zetas[64 + i]);
        basemul(&r[4*i + 2], &a[4*i + 2], &b[4*i + 2], -zetas[64 + i]);
    }
}

static void poly_tomont(sign16 *r)
{
    int i;
    const sign16 f = (1ULL << 32) % KY_PRIME;
    for(i=0;i<KY_DEGREE;i++)
        r[i] = montgomery_reduce((sign32)r[i]*f);
}

/* End of public domain reference code use */

// copy polynomial
static void poly_copy(sign16 *p1, sign16 *p2)
{
    int i;
    for (i = 0; i < KY_DEGREE; i++)
        p1[i] = p2[i];
}

// zero polynomial
static void poly_zero(sign16 *p1)
{
    int i;
    for (i = 0; i < KY_DEGREE; i++)
        p1[i] = 0;
}

// add polynomials
static void poly_add(sign16 *p1, sign16 *p2, sign16 *p3)
{
    int i;
    for (i = 0; i < KY_DEGREE; i++)
        p1[i] = (p2[i] + p3[i]);
}

// subtract polynomials
static void poly_sub(sign16 *p1, sign16 *p2, sign16 *p3)
{
    int i;
    for (i = 0; i < KY_DEGREE; i++)
        p1[i] = (p2[i] - p3[i]);
}

// Generate A[i][j] from rho
static void ExpandAij(byte rho[32],sign16 Aij[],int i,int j)
{
    int m;
    sha3 sh;
    SHA3_init(&sh, SHAKE128);
    byte buff[640];  // should be plenty (?)
    for (m=0;m<32;m++)
        SHA3_process(&sh,rho[m]);
    SHA3_process(&sh,j&0xff);
    SHA3_process(&sh,i&0xff);
    SHA3_shake(&sh,(char *)buff,640);
	i=j=0;
	while (j<KY_DEGREE)
	{
		int d1=buff[i]+256*(buff[i+1]&0x0F);
		int d2=buff[i+1]/16+16*buff[i+2];
		if (d1<KY_PRIME)
			Aij[j++]=d1;
		if (d2<KY_PRIME && j<KY_DEGREE)
			Aij[j++]=d2;
		i+=3;
	}
}

// get n-th bit from byte array
static int getbit(byte b[],int n)
{
	int wd=n/8;
	int bt=n%8;
	return (b[wd]>>bt)&1;
}

// centered binomial distribution
static void CBD(byte bts[],int eta,sign16 f[KY_DEGREE])
{
	int a,b;
	for (int i=0;i<KY_DEGREE;i++)
	{
		a=b=0;
		for (int j=0;j<eta;j++)
		{
			a+=getbit(bts,2*i*eta+j);
			b+=getbit(bts,2*i*eta+eta+j);
		}
		f[i]=a-b; 
	}
}

// extract ab bits into word from dense byte stream
static sign16 nextword(int ab,byte t[],int &ptr, int &bts)
{
    sign16 r=t[ptr]>>bts;
    sign16 mask=(1<<ab)-1;
    sign16 w;
    int i=0;
    int gotbits=8-bts; // bits left in current byte
    while (gotbits<ab)
    {
        i++;
        w=(sign16)t[ptr+i];
        r|=w<<gotbits;
        gotbits+=8;
    }
    bts+=ab;
    while (bts>=8)
    {
        bts-=8;
        ptr++;
    }
    w=r&mask;
    return w;  
}

// array t has ab active bits per word
// extract bytes from array of words
// if max!=0 then -max<=t[i]<=+max
static byte nextbyte16(int ab,sign16 t[],int &ptr, int &bts)
{
    sign16 r,w;
    int left=ab-bts; // number of bits left in this word
    int i=0;

    w=t[ptr]; w+=(w>>15)&KY_PRIME;
    r=w>>bts;
    while (left<8)
    {
        i++;
        w=t[ptr+i]; w+=(w>>15)&KY_PRIME;
        r|=w<<left;
        left+=ab;
    }

    bts+=8;
    while (bts>=ab)
    {
        bts-=ab;
        ptr++;
    }
    return (byte)r&0xff;        
}

// encode polynomial vector of length len with coefficients of length 2^L, into packed bytes
static int encode(sign16 t[],int len,int L,byte pack[])
{
    int ptr,bts,i,n;
    n=0; ptr=bts=0;
    for (i=0;i<len*(KY_DEGREE*L)/8;i++ ) {
        pack[n++]=nextbyte16(L,t,ptr,bts);
    }
    return n;
}

// decode packed bytes into polynomial vector of length len, with coefficients of length 2^L
static void decode(byte pack[],int L,sign16 t[],int len)
{
    int ptr,bts,i;
    ptr=bts=0;
    for (i=0;i<len*KY_DEGREE;i++ )
        t[i]=nextword(L,pack,ptr,bts);
}

// compress polynomial coefficents in place, for polynomial vector of length len
static void compress(sign16 t[],int len,int d)
{
	int twod=(1<<d);
	for (int i=0;i<len*KY_DEGREE;i++)
    {
        t[i]+=(t[i]>>15)&KY_PRIME;
		t[i]= ((twod*t[i]+KY_PRIME/2)/KY_PRIME)&(twod-1);
    }
}

// decompress polynomial coefficents in place, for polynomial vector of length len
static void decompress(sign16 t[],int len,int d)
{
	int twod1=(1<<(d-1));
	for (int i=0;i<len*KY_DEGREE;i++)
		t[i]=(KY_PRIME*t[i]+twod1)>>d;
}

// ********************* Kyber API ******************************

// input entropy, output key pair
void core::KYBER_CPA_keypair(byte *tau,octet *sk,octet *pk)
{
    int i,j,k,row;
    sha3 sh;
    byte rho[32];
	byte sigma[33];
	byte buff[256];

    sign16 r[KY_DEGREE];
    sign16 w[KY_DEGREE];
    sign16 Aij[KY_DEGREE]; 
    sign16 s[KY_K*KY_DEGREE];
    sign16 e[KY_K*KY_DEGREE];
    sign16 p[KY_K*KY_DEGREE];

    SHA3_init(&sh,SHA3_HASH512);
   
    for (i=0;i<32;i++)
        SHA3_process(&sh,tau[i]); 
	SHA3_hash(&sh,(char *)buff);
	for (i=0;i<32;i++)
	{
		rho[i]=buff[i];
		sigma[i]=buff[i+32];
	}

	sigma[32]=0;   // N
// create s
	for (i=0;i<KY_K;i++)
	{
		SHA3_init(&sh,SHAKE256);
		for (j=0;j<33;j++)
			SHA3_process(&sh,sigma[j]); 
		SHA3_shake(&sh,(char *)buff,64*KY_ETA1);
		CBD(buff,KY_ETA1,&s[i*KY_DEGREE]);
		sigma[32]+=1;
	}

// create e
	for (i=0;i<KY_K;i++)
	{
		SHA3_init(&sh,SHAKE256);
		for (j=0;j<33;j++)
			SHA3_process(&sh,sigma[j]); 
		SHA3_shake(&sh,(char *)buff,64*KY_ETA1);
		CBD(buff,KY_ETA1,&e[i*KY_DEGREE]);
		sigma[32]+=1;
	}

    for (k=0;k<KY_K;k++)
    {
        row=KY_DEGREE*k;
        poly_ntt(&s[row]);
        poly_ntt(&e[row]);
    }

    for (i=0;i<KY_K;i++)
    {
        row=KY_DEGREE*i;
        ExpandAij(rho,Aij,i,0);
        poly_mul(r,Aij,s);
        for (j=1;j<KY_K;j++)
        {
            ExpandAij(rho,Aij,i,j);
            poly_mul(w,&s[j*KY_DEGREE],Aij);
            poly_add(r,r,w);
        }
        poly_reduce(r);
        poly_tomont(r);
        poly_add(&p[row],r,&e[row]);
        poly_reduce(&p[row]);
    }

    sk->len=encode(s,KY_K,12,(byte *)sk->val);

    pk->len=encode(p,KY_K,12,(byte *)pk->val);
    for (i=0;i<32;i++)
        pk->val[pk->len++]=rho[i];
}

// provide 64 random bytes, output secret and public keys
void core::KYBER_CCA_keypair(byte *randbytes64,octet *sk,octet *pk)
{
    int i;
    sha3 sh;
    byte h[32];
    KYBER_CPA_keypair(randbytes64,sk,pk);
    OCT_joctet(sk,pk);

    SHA3_init(&sh,SHA3_HASH256);
    for (i=0;i<pk->len;i++)
        SHA3_process(&sh,(byte)pk->val[i]);
    SHA3_hash(&sh,(char *)h);
    OCT_jbytes(sk,(char *)h,32);
    OCT_jbytes(sk,(char *)&randbytes64[32],32);
}

// Given input of entropy, public key and shared secret is an input, outputs ciphertext
void core::KYBER_CPA_encrypt(byte *coins,octet *pk,byte *ss,octet *ct)
{
    int i,row,j,len;
    sha3 sh;
    byte sigma[33];
	byte buff[256];
    byte rho[32];

    sign16 r[KY_DEGREE];
    sign16 w[KY_DEGREE];
    sign16 v[KY_DEGREE];
    sign16 Aij[KY_DEGREE]; 
    sign16 u[KY_K*KY_DEGREE];
    sign16 q[KY_K*KY_DEGREE];
    sign16 p[KY_K*KY_DEGREE];

    for (i=0;i<32;i++)
        sigma[i]=coins[i];//i+6; //RAND_byte(RNG);
	sigma[32]=0;

    for (i=0;i<32;i++)
        rho[i]=pk->val[pk->len-32+i];

// create q
	for (i=0;i<KY_K;i++)
	{
		SHA3_init(&sh,SHAKE256);
		for (j=0;j<33;j++)
			SHA3_process(&sh,sigma[j]); 
		SHA3_shake(&sh,(char *)buff,64*KY_ETA1);
		CBD(buff,KY_ETA1,&q[i*KY_DEGREE]);
		sigma[32]+=1;
	}

// create e1
	for (i=0;i<KY_K;i++)
	{
		SHA3_init(&sh,SHAKE256);
		for (j=0;j<33;j++)
			SHA3_process(&sh,sigma[j]); 
		SHA3_shake(&sh,(char *)buff,64*KY_ETA2);
		CBD(buff,KY_ETA1,&u[i*KY_DEGREE]);          // e1
		sigma[32]+=1;
	}

    for (i=0;i<KY_K;i++)
    {
        row=KY_DEGREE*i;
        poly_ntt(&q[row]);
    }

    for (i=0;i<KY_K;i++)
    {
        row=KY_DEGREE*i;
        ExpandAij(rho,Aij,0,i);
        poly_mul(r,Aij,q);
        for (j=1;j<KY_K;j++)
        {
            ExpandAij(rho,Aij,j,i);
            poly_mul(w,&q[j*KY_DEGREE],Aij);
            poly_add(r,r,w);
        }
        poly_reduce(r);
        poly_invntt(r);
        poly_add(&u[row],&u[row],r);
        poly_reduce(&u[row]);
    }

    decode((byte *)pk->val,12,p,KY_K);

    poly_mul(v,p,q);
    for (i=1;i<KY_K;i++)
    {
        row=KY_DEGREE*i;
        poly_mul(r,&p[row],&q[row]);
        poly_add(v,v,r);
    }
    poly_invntt(v);

// create e2
    SHA3_init(&sh,SHAKE256);
	for (j=0;j<33;j++)
		SHA3_process(&sh,sigma[j]); 
	SHA3_shake(&sh,(char *)buff,64*KY_ETA2);
	CBD(buff,KY_ETA1,w);  // e2

    poly_add(v,v,w);
    
    decode(ss,1,r,1);
    decompress(r,1,1);
   
    poly_add(v,v,r);
    poly_reduce(v);

    compress(u,KY_K,KY_DU);
    compress(v,1,KY_DV);
    ct->len=encode(u,KY_K,KY_DU,(byte *)ct->val);
    ct->len+=encode(v,1,KY_DV,(byte *)&ct->val[ct->len]);
}

// Given entropy and public key, outputs 32-byte shared secret and ciphertext
void core::KYBER_CCA_encrypt(byte *randbytes32,octet *pk,byte *ss,octet *ct)
{
    int i;
    sha3 sh;
    byte h[32],hm[32],g[64],coins[32];

    SHA3_init(&sh,SHA3_HASH256);               // H(m)
    for (i=0;i<32;i++)
        SHA3_process(&sh,randbytes32[i]);
    SHA3_hash(&sh,(char *)hm);

    SHA3_init(&sh,SHA3_HASH256);               // H(pk)
    for (i=0;i<pk->len;i++)
        SHA3_process(&sh,(byte)pk->val[i]);
    SHA3_hash(&sh,(char *)h);

    SHA3_init(&sh,SHA3_HASH512);               // Kb,r = G(H(m)|H(pk)
    for (i=0;i<32;i++)
        SHA3_process(&sh,hm[i]);
    for (i=0;i<32;i++)
        SHA3_process(&sh,h[i]);
    SHA3_hash(&sh,(char *)g);

    for (i=0;i<32;i++)
        coins[i]=g[i+32];
    KYBER_CPA_encrypt(coins,pk,hm,ct);
    
    SHA3_init(&sh,SHA3_HASH256);              // H(ct)
    for (i=0;i<ct->len;i++)
        SHA3_process(&sh,(byte)ct->val[i]);
    SHA3_hash(&sh,(char *)h);

    SHA3_init(&sh,SHAKE256);                  // K=KDF(Kb|H(ct))
    for (i=0;i<32;i++)
        SHA3_process(&sh,g[i]);
    for (i=0;i<32;i++)
        SHA3_process(&sh,h[i]);

    SHA3_shake(&sh,(char *)ss,32); // could be any length?
}

// Input secret key and ciphertext, outputs shared 32-byte secret
void core::KYBER_CPA_decrypt(octet *sk,octet *ct,byte *ss)
{
	int i,j,row;
	sign16 w[KY_DEGREE];
    sign16 v[KY_DEGREE];
    sign16 r[KY_DEGREE];
    sign16 u[KY_K*KY_DEGREE];
    sign16 s[KY_K*KY_DEGREE];

    decode((byte *)ct->val,KY_DU,u,KY_K);
    decode((byte *)&ct->val[KY_DU*KY_K*KY_DEGREE/8],KY_DV,v,1);
    decompress(u,KY_K,KY_DU);
    decompress(v,1,KY_DV);
    decode((byte *)sk->val,12,s,KY_K);

    poly_ntt(u);
    poly_mul(w,u,s);
    for (i=1;i<KY_K;i++)
    {
        row=KY_DEGREE*i;
        poly_ntt(&u[row]);
        poly_mul(r,&u[row],&s[row]);
        poly_add(w,w,r);
    }
    poly_reduce(w);
    poly_invntt(w);
    poly_sub(v,v,w);
    compress(v,1,1);
    encode(v,1,1,ss);
    
}

void core::KYBER_CCA_decrypt(octet *sk,octet *ct,byte *ss)
{ 
    int i,olen,same;
    sha3 sh;
    byte h[32],z[32],m[32],coins[32],g[64];
    char pk[KYBER_PUBLIC],mct[KYBER_CIPHERTEXT];
    octet PK = {KYBER_PUBLIC, sizeof(pk), pk};
    octet CT = {0,sizeof(mct),mct};
    olen=sk->len;
    sk->len=KYBER_SECRET_CPA;
    for (i=0;i<KYBER_PUBLIC;i++)
        PK.val[i]=sk->val[KYBER_SECRET_CPA+i];
    for (i=0;i<32;i++)
        h[i]=sk->val[KYBER_SECRET_CPA+KYBER_PUBLIC+i];
    for (i=0;i<32;i++)
        z[i]=sk->val[KYBER_SECRET_CPA+KYBER_PUBLIC+32+i];

    KYBER_CPA_decrypt(sk,ct,m);

    SHA3_init(&sh,SHA3_HASH512);               // Kb,r = G(H(m)|H(pk)
    for (i=0;i<32;i++)
        SHA3_process(&sh,m[i]);
    for (i=0;i<32;i++)
        SHA3_process(&sh,h[i]);
    SHA3_hash(&sh,(char *)g);

    for (i=0;i<32;i++)
        coins[i]=g[i+32];
    KYBER_CPA_encrypt(coins,&PK,m,&CT);       // encrypt again with public key - FO transform CPA->CCA 
    same=OCT_comp(ct,&CT); same-=1;

    for (i=0;i<32;i++)
        g[i]^=(g[i]^z[i])&same;               // substitute z for Kb on failure

    SHA3_init(&sh,SHA3_HASH256);              // H(ct)
    for (i=0;i<ct->len;i++)
        SHA3_process(&sh,(byte)ct->val[i]);
    SHA3_hash(&sh,(char *)h);

    SHA3_init(&sh,SHAKE256);                  // K=KDF(Kb|H(ct))
    for (i=0;i<32;i++)
        SHA3_process(&sh,g[i]);
    for (i=0;i<32;i++)
        SHA3_process(&sh,h[i]);
    
    SHA3_shake(&sh,(char *)ss,32); // could be any length?

    sk->len=olen;
}
