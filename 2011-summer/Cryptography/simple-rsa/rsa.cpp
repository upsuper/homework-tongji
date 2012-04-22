#include <iostream>
#include <bitset>
#include <cassert>
#include <ctime>
#include <iomanip>
using namespace std;

// Pseudorandom Number Initialization
const long kPRNI = time(NULL);
//const long kPRNI = 0xdeadbeef;

long generatePRN(int length) {
    static bitset<32> a(kPRNI);
    static bitset<32> z;
    static int left = 0;
    
    // for convenience, this function does not support length over 16.
    // in fact, in this program, we will never use such a large length.
    assert(length <= 16);

    if (length > left) {
        while (left < 16) {
            // generate z
            for (int i = 0; i < 32; i += 2) {
                if (a[i])
                    z[left++] = a[i + 1];
            }
            // generate new a
            bitset<64> new_a(a.to_ulong());
            for (int i = 32; i < 64; ++i) {
                new_a[i] = new_a[i - 2] ^ new_a[i - 3] ^
                           new_a[i - 7] ^ new_a[i - 32];
                a[i - 32] = new_a[i];
            }
        }
    }
    
    long ret = z.to_ulong() & ((1 << length) - 1);
    z >>= length;
    left -= length;
    
    return ret;
}

long pow(long a, long d, long n) {
    // pow(a, d, n) = a^d % n
    if (d == 0) {
        return 1;
    } else if (d == 1) {
        return a;
    } else if ((d & 1) == 0) {
        return pow(a * a % n, d / 2, n) % n;
    } else {
        return pow(a * a % n, d / 2, n) * a % n;
    }
}

bool millerRabin(long n, long a) {
    if (n == 2) return true;
    if (n == 1 || (n & 1) == 0) return 0;
    long d = n - 1;
    while ((d & 1) == 0)
        d >>= 1;
    long t = pow(a, d, n);
    while (d != n - 1 && t != 1 && t != n - 1) {
        t = t * t % n;
        d <<= 1;
    }
    return t == n - 1 || (d & 1) == 1;
}

bool isPrime(long n) {
    // it is enough to check if a number
    // less than 4,759,123,141 is a prime
    return millerRabin(n, 2) &&
           millerRabin(n, 7) &&
           millerRabin(n, 61);
}

long euclidean(long a, long b) {
    long r0 = a, r1 = b;
    long t0 = 0, t1 = 1;
    long q, t;
    do {
        q = r0 / r1;
        t = (t0 - q * t1) % a;
        t0 = t1, t1 = t;
        t = r0 - q * r1;
        r0 = r1, r1 = t;
    } while (r1 != 0);
    if (r0 == 1)
        return t0 < 0 ? (t0 + a) % a : t0;
    else
        return -1;
}

int main() {
    long p, q, n, phi, a, b, x, y;
    do {
        do {
            p = 0x81 /* 1000 0001 */ + (generatePRN(6) << 1);
        } while (! isPrime(p));
        do {
            q = 0x41 /* 0100 0001 */ + (generatePRN(5) << 1);
        } while (! isPrime(q));
        n = p * q;
    } while ((n & 0xffff8000) != 0 || (n & 0x4000) == 0);
    phi = (p - 1) * (q - 1);
    do {
        b = generatePRN(10);
    } while ((a = euclidean(phi, b)) == -1);
    cout << "p = " << p << endl
         << "q = " << q << endl
         << "n = " << n << endl
         << "phi = " << phi << endl
         << "a = " << a << endl
         << "b = " << b << endl;
    while (true) {
        cerr << "x = ";
        cin >> x;
        if (x == 0) break;
        y = pow(x, b, n);
        cout << "y = " << y << endl;
    }
    return 0;
}
