// 迭代式慢哈希加盐（PBKDF2-HMAC-SHA256）— C++ 从零手写实现（教学版）
//
// 不依赖任何第三方库，完整实现 SHA-256（FIPS 180-4）、HMAC（RFC 2104）、
// PBKDF2（RFC 2898），帮助理解慢哈希加盐的内部原理。
//
// 编译运行：
//   g++ -std=c++17 -O2 pbkdf2_manual.cpp -o pbkdf2_manual
//   ./pbkdf2_manual
//
// 注意：
//   - 手写版本仅用于学习；生产环境请使用 OpenSSL / libsodium / 标准库。
//   - 示例中的盐生成使用 std::random_device 演示；生产环境必须使用
//     CSPRNG（如 OpenSSL RAND_bytes、Windows BCryptGenRandom）。

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <vector>

using Bytes = std::vector<uint8_t>;

// ===========================================================================
// SHA-256（FIPS 180-4）
// ===========================================================================
namespace sha {

constexpr size_t BLOCK = 64;
constexpr size_t DIGEST = 32;

static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

inline uint32_t rotr(uint32_t x, int n) {
    return (x >> n) | (x << (32 - n));
}

void compress(uint32_t h[8], const uint8_t* block) {
    uint32_t w[64];
    for (int i = 0; i < 16; ++i) {
        w[i] = (uint32_t(block[i * 4]) << 24) | (uint32_t(block[i * 4 + 1]) << 16) |
               (uint32_t(block[i * 4 + 2]) << 8) | uint32_t(block[i * 4 + 3]);
    }
    for (int i = 16; i < 64; ++i) {
        uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
        uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }

    uint32_t a = h[0], b = h[1], c = h[2], d = h[3];
    uint32_t e = h[4], f = h[5], g = h[6], hh = h[7];
    for (int i = 0; i < 64; ++i) {
        uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        uint32_t ch = (e & f) ^ (~e & g);
        uint32_t t1 = hh + S1 + ch + K[i] + w[i];
        uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        uint32_t t2 = S0 + maj;
        hh = g; g = f; f = e; e = d + t1;
        d = c; c = b; b = a; a = t1 + t2;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d;
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
}

struct Hasher {
    uint32_t h[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };
    uint64_t total = 0;          // 已处理的字节数
    Bytes pending;               // 不满 64 字节的缓冲

    void update(const uint8_t* data, size_t len) {
        total += len;
        pending.insert(pending.end(), data, data + len);
        while (pending.size() >= BLOCK) {
            compress(h, pending.data());
            pending.erase(pending.begin(), pending.begin() + BLOCK);
        }
    }

    Bytes final() {
        uint64_t bits = total * 8;
        pending.push_back(0x80);
        while (pending.size() % BLOCK != 56) {
            pending.push_back(0x00);
        }
        for (int i = 7; i >= 0; --i) {
            pending.push_back(uint8_t(bits >> (i * 8)));
        }
        while (!pending.empty()) {
            if (pending.size() >= BLOCK) {
                compress(h, pending.data());
                pending.erase(pending.begin(), pending.begin() + BLOCK);
            } else {
                Bytes block(BLOCK, 0);
                std::copy(pending.begin(), pending.end(), block.begin());
                compress(h, block.data());
                pending.clear();
            }
        }
        Bytes out;
        out.reserve(DIGEST);
        for (int i = 0; i < 8; ++i) {
            out.push_back(uint8_t(h[i] >> 24));
            out.push_back(uint8_t(h[i] >> 16));
            out.push_back(uint8_t(h[i] >> 8));
            out.push_back(uint8_t(h[i]));
        }
        return out;
    }
};

Bytes digest(const Bytes& data) {
    Hasher h;
    h.update(data.data(), data.size());
    return h.final();
}

}  // namespace sha

// ===========================================================================
// HMAC-SHA256（RFC 2104）
// ===========================================================================
Bytes hmac_sha256(const Bytes& key, const uint8_t* msg, size_t msg_len) {
    constexpr size_t B = sha::BLOCK;
    Bytes k = key;
    if (k.size() > B) {
        k = sha::digest(k);
    }
    k.resize(B, 0);

    Bytes ipad(B), opad(B);
    for (size_t i = 0; i < B; ++i) {
        ipad[i] = k[i] ^ 0x36;
        opad[i] = k[i] ^ 0x5c;
    }

    sha::Hasher inner;
    inner.update(ipad.data(), ipad.size());
    inner.update(msg, msg_len);
    Bytes ih = inner.final();

    sha::Hasher outer;
    outer.update(opad.data(), opad.size());
    outer.update(ih.data(), ih.size());
    return outer.final();
}

// ===========================================================================
// PBKDF2（RFC 2898）
// ===========================================================================
constexpr uint32_t ITERATIONS = 310000;  // OWASP 推荐：SHA-256 至少 31 万次
constexpr size_t SALT_LEN = 16;
constexpr size_t KEY_LEN = 32;

Bytes pbkdf2_sha256(const std::string& password,
                    const Bytes& salt,
                    uint32_t iterations = ITERATIONS,
                    size_t dklen = KEY_LEN) {
    Bytes pwd(password.begin(), password.end());
    const size_t hlen = sha::DIGEST;  // 32 字节
    const size_t blocks = (dklen + hlen - 1) / hlen;
    Bytes out;
    out.reserve(blocks * hlen);

    for (uint32_t block = 1; block <= blocks; ++block) {
        // U1 = HMAC(P, S || INT_32_BE(block))
        Bytes s = salt;
        s.push_back(uint8_t(block >> 24));
        s.push_back(uint8_t(block >> 16));
        s.push_back(uint8_t(block >> 8));
        s.push_back(uint8_t(block));
        Bytes u = hmac_sha256(pwd, s.data(), s.size());
        Bytes t = u;
        // Uc = HMAC(P, Uc-1)，T = U1 XOR U2 XOR ... XOR Uc
        for (uint32_t i = 1; i < iterations; ++i) {
            u = hmac_sha256(pwd, u.data(), u.size());
            for (size_t j = 0; j < t.size(); ++j) {
                t[j] ^= u[j];
            }
        }
        out.insert(out.end(), t.begin(), t.end());
    }
    out.resize(dklen);
    return out;
}

// 恒时比较：避免根据比较结果提前返回造成时序泄露
bool consttime_equal(const Bytes& a, const Bytes& b) {
    if (a.size() != b.size()) return false;
    uint8_t diff = 0;
    for (size_t i = 0; i < a.size(); ++i) {
        diff |= a[i] ^ b[i];
    }
    return diff == 0;
}

bool verify(const std::string& password,
            const Bytes& salt,
            const Bytes& expected,
            uint32_t iterations = ITERATIONS) {
    return consttime_equal(pbkdf2_sha256(password, salt, iterations, expected.size()), expected);
}

// 演示用盐生成（生产环境必须改用 CSPRNG）
Bytes demo_salt(size_t len = SALT_LEN) {
    std::random_device rd;
    std::mt19937_64 gen(rd());
    Bytes salt(len);
    for (size_t i = 0; i < len; ++i) {
        salt[i] = static_cast<uint8_t>(gen());
    }
    return salt;
}

std::string hex(const Bytes& data) {
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (uint8_t c : data) {
        oss << std::setw(2) << static_cast<int>(c);
    }
    return oss.str();
}

// ---------------- 测试 ----------------

void test_sha256_vector() {
    // 空字符串的 SHA-256：e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    Bytes out = sha::digest(Bytes{});
    const char* expect =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    std::cout << "SHA-256(\"\") : " << hex(out)
              << (hex(out) == expect ? "  [PASS]" : "  [FAIL]") << "\n";
}

void test_hmac_vector() {
    // RFC 4231 测试用例 1：key = 0x0b × 20，data = "Hi There"
    Bytes key(20, 0x0b);
    const char* msg = "Hi There";
    Bytes out = hmac_sha256(key, reinterpret_cast<const uint8_t*>(msg), std::strlen(msg));
    const char* expect =
        "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";
    std::cout << "HMAC(RFC4231) : " << hex(out)
              << (hex(out) == expect ? "  [PASS]" : "  [FAIL]") << "\n";
}

void test_pbkdf2_vectors() {
    Bytes salt = {'s', 'a', 'l', 't'};
    Bytes v1 = pbkdf2_sha256("password", salt, 1, 32);
    Bytes v4096 = pbkdf2_sha256("password", salt, 4096, 32);
    const char* expect1 =
        "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b";
    const char* expect4096 =
        "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a";
    std::cout << "PBKDF2 c=1    : " << hex(v1)
              << (hex(v1) == expect1 ? "  [PASS]" : "  [FAIL]") << "\n";
    std::cout << "PBKDF2 c=4096 : " << hex(v4096)
              << (hex(v4096) == expect4096 ? "  [PASS]" : "  [FAIL]") << "\n";
}

int main() {
    test_sha256_vector();
    test_hmac_vector();
    test_pbkdf2_vectors();

    const std::string password = "example-password-123!";
    Bytes salt = demo_salt();

    // 310,000 次迭代约需 0.3~1 秒
    Bytes dk = pbkdf2_sha256(password, salt);
    bool ok_true = verify(password, salt, dk);
    bool ok_false = verify("wrong-password", salt, dk);

    std::cout << "verify(correct) = " << (ok_true ? "true" : "false")
              << "  verify(wrong) = " << (ok_false ? "true" : "false") << "\n";
    std::cout << "salt(hex)      : " << hex(salt) << "\n";
    std::cout << "key (hex)      : " << hex(dk) << "\n";
    return 0;
}
