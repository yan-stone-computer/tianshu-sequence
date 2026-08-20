# 迭代式慢哈希加盐（Password Hashing）技术指南

> 面向口令/校验码等敏感信息的存储场景。核心结论一句话：
> **不要存明文，不要用 MD5/SHA1 裸哈希，使用带随机盐的迭代式慢哈希（PBKDF2 / bcrypt / scrypt / Argon2）。**

本指南配套代码实现：

| 文件 | 说明 | 运行 |
|---|---|---|
| `examples/pbkdf2_python.py` | Python：标准库推荐写法 + 手写教学版 + scrypt | `python pbkdf2_python.py` |
| `examples/pbkdf2_openssl.cpp` | C++：OpenSSL 生产版（PBKDF2 + scrypt） | `g++ -std=c++17 -O2 pbkdf2_openssl.cpp -o pbkdf2_openssl -lssl -lcrypto` |
| `examples/pbkdf2_manual.cpp` | C++：从零手写 SHA-256 / HMAC / PBKDF2（教学版，零依赖） | `g++ -std=c++17 -O2 pbkdf2_manual.cpp -o pbkdf2_manual` |

---

## 1. 为什么需要慢哈希 + 盐

口令/校验码一旦泄露，攻击者会尝试：

1. **彩虹表**：预先算好海量常见口令的哈希，直接反查。→ 用**盐**打散。
2. **GPU / ASIC 暴力破解**：每秒可尝试数十亿次快速哈希（如 MD5、SHA-1、SHA-256）。→ 用**迭代/内存型慢哈希**抬高单次成本。
3. **撞库**：同一个口令在多个站点哈希相同，一破全破。→ 用**随机盐**让相同口令的哈希值各不相同。

哈希是单向的，这是"不可逆存储"的前提；但**快速哈希**（MD5/SHA 系列裸用）在口令场景下等于没加密。

## 2. 核心概念

| 术语 | 含义 |
|---|---|
| **哈希 (Hash)** | 单向函数，输入任意长度 → 固定长度输出，无法逆向 |
| **盐 (Salt)** | 每个账号独立的随机字节串，与口令一起参与计算，用于打散彩虹表 |
| **迭代 (Iterations)** | 把哈希过程重复 N 次，抬高单次计算成本 |
| **慢哈希 (Slow Hash / KDF)** | 专门设计为"故意慢"的密码派生函数（Password-Based KDF） |
| **派生密钥 (DK)** | KDF 的输出，即最终存储/校验的值 |

> 注意：这里的"加密"是通俗说法。严格讲哈希不是可逆加密；口令存储用的是 **KDF（密钥派生函数）**，且**永远不需要解密**，只需要重新计算后比较。

## 3. 主流算法对比

| 算法 | 原理 | 内存占用 | 抗 GPU/ASIC | 推荐场景 |
|---|---|---|---|---|
| **PBKDF2** | 对 HMAC 反复迭代 | 低 | 弱（易被 ASIC 加速，靠迭代次数弥补） | 通用、兼容性最好（标准库原生支持） |
| **bcrypt** | Blowfish 密钥调度迭代 | 4 KB | 中 | 老牌 Web 应用，语言支持广泛 |
| **scrypt** | PBKDF2 + 大内存填充（Salsa20/8 轮） | 高（可配置） | 强 | 需要抗硬件爆破时 |
| **Argon2** | 内存硬函数（Argon2id 兼顾侧信道防护） | 高（可配置） | 最强 | 新项目首选（PHC 大赛冠军） |

一句话选型：

- 新项目：**Argon2id**（Python 可装 `argon2-cffi`，C++ 可用 libsodium/argon2 库）。
- 追求零依赖、标准库自带：**PBKDF2-HMAC-SHA256**（Python `hashlib`、C++ OpenSSL、Java、Go 等全部内置）。
- 需要内存型抗 ASIC 又不引入新依赖：**scrypt**（Python `hashlib.scrypt`、OpenSSL `EVP_PBE_scrypt`）。

## 4. 安全参数推荐（OWASP 2023 Password Storage Cheat Sheet）

| 算法 | 推荐参数 |
|---|---|
| PBKDF2-HMAC-SHA256 | 迭代 ≥ **310,000** 次，输出 32 字节 |
| PBKDF2-HMAC-SHA512 | 迭代 ≥ **210,000** 次，输出 64 字节 |
| bcrypt | cost = **12**（约 2^12 轮） |
| scrypt | N = **2^17**（131072），r = **8**，p = **1**（内存约 128 MB） |
| Argon2id | m = **19456 KiB（19 MB）**，t = **2**，p = **1** |

参数会随算力增长而提高，建议把参数（迭代次数/内存/并行度）**随哈希一起存储**，便于日后升级时逐步重哈希。

## 5. 盐：生成、长度与存储

```text
盐 = CSPRNG 生成的 16 字节（128 bit）随机数，每个账号独立
```

- 生成：必须用密码学安全随机源（`os.urandom` / `RAND_bytes` / `BCryptGenRandom`），不要用 `rand()`、时间戳、用户名。
- 长度：16 字节起，更长无害。
- **盐不需要保密**，与哈希一起存进数据库即可；它的作用是让彩虹表失效，不是充当密钥。

## 6. 推荐存储格式

把算法、参数、盐、哈希放在同一个字符串里，方便校验和升级：

```text
pbkdf2_sha256$310000$<盐 base64>$<派生密钥 base64>
$argon2id$v=19$m=19456,t=2,p=1$<盐 base64>$<哈希 base64>
```

示例（Python 程序生成的真实输出）：

```text
pbkdf2_sha256$310000$YuwO4NIzxutpy7VFevZqGg==$UUe9WhFmXm1/4CBPGHzDi9dY4asHK1AfCGozzy2HZIk=
```

## 7. 校验：恒时比较

比对哈希时禁止用 `==` 提前返回（时序侧信道可被用来逐字节猜哈希）。应使用恒时比较：

| 语言/库 | 恒时比较函数 |
|---|---|
| Python | `hmac.compare_digest(a, b)` |
| C++ OpenSSL | `CRYPTO_memcmp(a, b, n)` |
| PHP | `hash_equals()` |
| Node.js | `crypto.timingSafeEqual()` |
| Go | `crypto/subtle.ConstantTimeCompare()` |

## 8. 常见误区清单

- ❌ 存明文 / 可逆加密（如 AES 加密口令）——能解密就违背存储原则。
- ❌ 用 MD5、SHA-1、SHA-256 裸哈希——GPU 一秒可跑几十亿次。
- ❌ 所有账号共用一个固定盐（如"tianshu2026"）——彩虹表仍然有效。
- ❌ 自创"算法"或自己改标准算法（如把 SHA-256 拼几遍）——没有经过同行审计。
- ❌ 把校验逻辑只放在前端——任何人都能改前端绕过；必须由服务端执行。
- ❌ 对超长口令截断（如只取前 8 位）——应至少允许 64~128 字符并全量参与哈希。
- ❌ 忘记随算力升级参数——上线后要支持按存储串中的参数重哈希迁移。

## 9. 与本站项目的对应关系

官网"技术文章投稿"的校验码存储（`article-config.js`）采用的就是本技术：

- 算法：PBKDF2-HMAC-SHA256
- 迭代：310,000 次（OWASP 2023 推荐值）
- 盐：16 字节随机（Base64 存储）
- 明文不落盘，前端提交后用 WebCrypto 重新派生并恒时比对
- 生产多用户部署时应把该校验迁移到服务端执行

## 10. 代码说明

### Python（`examples/pbkdf2_python.py`）

- `hash_password_stdlib()` / `verify_stdlib()`：生产推荐，`hashlib.pbkdf2_hmac`。
- `pbkdf2_manual()` / `hmac_sha256()`：手写教学版，与标准库输出一致（程序自检）。
- `hash_scrypt_stdlib()`：scrypt 实现（注意 `maxmem` 参数）。
- 自带 RFC 6070 风格测试向量与正确/错误口令自检。

### C++ OpenSSL（`examples/pbkdf2_openssl.cpp`）

- `pbkdf2_sha256()`：`PKCS5_PBKDF2_HMAC`（附 OpenSSL 3.x `EVP_KDF` 无告警写法注释）。
- `scrypt_sha256()`：`EVP_PBE_scrypt`（N=2^17, r=8, p=1）。
- `verify_pbkdf2()`：`CRYPTO_memcmp` 恒时比较。
- 自带 RFC 向量自检。

### C++ 手写版（`examples/pbkdf2_manual.cpp`）

- 零依赖实现 SHA-256（FIPS 180-4）、HMAC（RFC 2104）、PBKDF2（RFC 2898）。
- 自带三个测试：SHA-256 空串向量、RFC 4231 HMAC 向量、PBKDF2-HMAC-SHA256 标准向量。
- 教学价值高；生产请用 OpenSSL / libsodium。

## 11. 参考

- OWASP Password Storage Cheat Sheet：<https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- RFC 2898（PBKDF2）：<https://www.rfc-editor.org/rfc/rfc2898>
- RFC 2104（HMAC）：<https://www.rfc-editor.org/rfc/rfc2104>
- RFC 7914（scrypt）：<https://www.rfc-editor.org/rfc/rfc7914>
- Argon2（PHC 获胜算法）：<https://github.com/P-H-C/phc-winner-argon2>
