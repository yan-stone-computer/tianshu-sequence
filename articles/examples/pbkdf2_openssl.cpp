// 迭代式慢哈希加盐（PBKDF2 / scrypt）— C++ + OpenSSL 实现（生产推荐）
//
// 编译（Linux / macOS / WSL，需安装 OpenSSL 开发库）：
//   g++ -std=c++17 -O2 pbkdf2_openssl.cpp -o pbkdf2_openssl -lssl -lcrypto
//
// Windows（用 vcpkg 安装 openssl 后，在 VS 开发者命令行中）：
//   cl /EHsc /std:c++17 pbkdf2_openssl.cpp /I<openssl\include> /link /LIBPATH:<openssl\lib> libcrypto.lib
//
// 说明：
//   - PKCS5_PBKDF2_HMAC 在 OpenSSL 3.x 中标记为 deprecated，但 1.1.1 与 3.x 均可使用；
//     如需彻底无告警，可改用 EVP_KDF API（参考文件末尾注释）。
//   - 校验使用 CRYPTO_memcmp 恒时比较，避免时序侧信道。

#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/rand.h>

#include <cstdint>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using Bytes = std::vector<unsigned char>;

constexpr int ITERATIONS = 310000;  // OWASP 2023 推荐：PBKDF2-HMAC-SHA256 ≥ 310k
constexpr int SALT_LEN = 16;
constexpr int KEY_LEN = 32;

// ---------------- 基础工具 ----------------

Bytes random_salt(int len = SALT_LEN) {
    Bytes salt(static_cast<size_t>(len));
    if (RAND_bytes(salt.data(), len) != 1) {
        throw std::runtime_error("RAND_bytes failed");
    }
    return salt;
}

std::string hex(const Bytes& data) {
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (unsigned char c : data) oss << std::setw(2) << static_cast<int>(c);
    return oss.str();
}

static const char* B64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string b64encode(const Bytes& data) {
    std::string out;
    size_t i = 0;
    while (i + 3 <= data.size()) {
        uint32_t v = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        out += B64[(v >> 18) & 63];
        out += B64[(v >> 12) & 63];
        out += B64[(v >> 6) & 63];
        out += B64[v & 63];
        i += 3;
    }
    size_t rem = data.size() - i;
    if (rem == 1) {
        uint32_t v = data[i] << 16;
        out += B64[(v >> 18) & 63];
        out += B64[(v >> 12) & 63];
        out += "==";
    } else if (rem == 2) {
        uint32_t v = (data[i] << 16) | (data[i + 1] << 8);
        out += B64[(v >> 18) & 63];
        out += B64[(v >> 12) & 63];
        out += B64[(v >> 6) & 63];
        out += '=';
    }
    return out;
}

// ---------------- PBKDF2 ----------------

Bytes pbkdf2_sha256(const std::string& password,
                    const Bytes& salt,
                    int iterations = ITERATIONS,
                    int key_len = KEY_LEN) {
    Bytes key(static_cast<size_t>(key_len));
    int ok = PKCS5_PBKDF2_HMAC(password.c_str(), static_cast<int>(password.size()),
                               salt.data(), static_cast<int>(salt.size()),
                               iterations, EVP_sha256(),
                               key_len, key.data());
    if (ok != 1) {
        throw std::runtime_error("PBKDF2 failed");
    }
    return key;
}

bool verify_pbkdf2(const std::string& password,
                   const Bytes& salt,
                   const Bytes& expected_key,
                   int iterations = ITERATIONS) {
    Bytes key = pbkdf2_sha256(password, salt, iterations, static_cast<int>(expected_key.size()));
    return CRYPTO_memcmp(key.data(), expected_key.data(), key.size()) == 0;
}

// ---------------- scrypt ----------------

Bytes scrypt_sha256(const std::string& password,
                    const Bytes& salt,
                    uint64_t n = 1 << 17,
                    uint64_t r = 8,
                    uint64_t p = 1,
                    size_t key_len = KEY_LEN) {
    Bytes key(key_len);
    // maxmem：N=2^17, r=8 约需 128MB
    int ok = EVP_PBE_scrypt(password.c_str(), password.size(),
                            salt.data(), salt.size(),
                            n, r, p, 256ULL * 1024 * 1024,
                            key.data(), key.size());
    if (ok != 1) {
        throw std::runtime_error("scrypt failed");
    }
    return key;
}

// ---------------- 测试 ----------------

void test_rfc_vectors() {
    Bytes salt = {'s', 'a', 'l', 't'};
    Bytes v1 = pbkdf2_sha256("password", salt, 1, 32);
    Bytes v4096 = pbkdf2_sha256("password", salt, 4096, 32);

    const char* expect1 =
        "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b";
    const char* expect4096 =
        "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a";

    std::cout << "vector c=1    : " << hex(v1) << (hex(v1) == expect1 ? "  [PASS]" : "  [FAIL]") << "\n";
    std::cout << "vector c=4096 : " << hex(v4096) << (hex(v4096) == expect4096 ? "  [PASS]" : "  [FAIL]") << "\n";
}

int main() {
    test_rfc_vectors();

    const std::string password = "example-password-123!";
    Bytes salt = random_salt();

    // 310,000 次迭代在 C++ 中约需 0.3~1 秒
    Bytes dk = pbkdf2_sha256(password, salt);

    bool ok_true = verify_pbkdf2(password, salt, dk);
    bool ok_false = verify_pbkdf2("wrong-password", salt, dk);
    std::cout << "verify(correct) = " << (ok_true ? "true" : "false")
              << "  verify(wrong) = " << (ok_false ? "true" : "false") << "\n";

    std::cout << "存储串示例: pbkdf2_sha256$" << ITERATIONS << "$"
              << b64encode(salt) << "$" << b64encode(dk) << "\n";

    // scrypt 示例（OWASP 推荐参数 N=2^17, r=8, p=1）
    Bytes dk_scrypt = scrypt_sha256(password, salt);
    std::cout << "scrypt key len: " << dk_scrypt.size() << " bytes\n";

    return 0;
}

// ---------------------------------------------------------------------------
// 附：OpenSSL 3.x 无弃用告警的 EVP_KDF 写法（PBKDF2）
// ---------------------------------------------------------------------------
// #include <openssl/kdf.h>
// Bytes pbkdf2_sha256_evp(const std::string& password, const Bytes& salt,
//                         int iterations, int key_len) {
//     EVP_KDF* kdf = EVP_KDF_fetch(nullptr, "PBKDF2", nullptr);
//     EVP_KDF_CTX* ctx = EVP_KDF_CTX_new(kdf);
//     OSSL_PARAM params[5];
//     const char* pass = password.c_str();
//     int pass_len = static_cast<int>(password.size());
//     int salt_len = static_cast<int>(salt.size());
//     params[0] = OSSL_PARAM_construct_utf8_string("digest", const_cast<char*>("SHA256"), 0);
//     params[1] = OSSL_PARAM_construct_int("iter", &iterations);
//     params[2] = OSSL_PARAM_construct_octet_string("pass", const_cast<char*>(pass), pass_len);
//     params[3] = OSSL_PARAM_construct_octet_string("salt", const_cast<unsigned char*>(salt.data()), salt_len);
//     params[4] = OSSL_PARAM_construct_end();
//     Bytes key(static_cast<size_t>(key_len));
//     EVP_KDF_derive(ctx, key.data(), key.size(), params);
//     EVP_KDF_CTX_free(ctx);
//     EVP_KDF_free(kdf);
//     return key;
// }
