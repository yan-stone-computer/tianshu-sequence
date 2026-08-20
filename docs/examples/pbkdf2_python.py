# -*- coding: utf-8 -*-
"""
迭代式慢哈希加盐（PBKDF2-HMAC-SHA256）— Python 实现

包含三种写法：
  1) 推荐：标准库 hashlib.pbkdf2_hmac（生产环境使用，经过安全审计）
  2) 教学：从零手写 HMAC-SHA256 + PBKDF2（帮助理解算法原理，不要用于生产）
  3) scrypt：标准库 hashlib.scrypt（另一种推荐的慢哈希，抗 GPU/ASIC）

运行：
  python pbkdf2_python.py
"""

import hashlib
import hmac
import os
import base64

# 推荐安全参数（OWASP Password Storage Cheat Sheet 2023）
# PBKDF2-HMAC-SHA256：310,000 次迭代（2015 年推荐 100k，随算力增长持续上调）
ITERATIONS = 310_000
SALT_LEN = 16          # 盐长度：16 字节（128 bit）
KEY_LEN = 32           # 派生密钥长度：32 字节（256 bit）


def generate_salt(length: int = SALT_LEN) -> bytes:
    """使用操作系统密码学安全随机源生成盐。"""
    return os.urandom(length)


# ---------------------------------------------------------------------------
# 1) 标准库实现（生产推荐）
# ---------------------------------------------------------------------------
def hash_password_stdlib(
    password: str,
    salt: bytes | None = None,
    iterations: int = ITERATIONS,
    dklen: int = KEY_LEN,
) -> tuple[bytes, bytes]:
    """返回 (salt, derived_key)。"""
    salt = salt if salt is not None else generate_salt()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=dklen)
    return salt, dk


def verify_stdlib(
    password: str,
    salt: bytes,
    expected_dk: bytes,
    iterations: int = ITERATIONS,
    dklen: int = KEY_LEN,
) -> bool:
    """校验口令：重新派生后与存储值做恒时比较。"""
    _, dk = hash_password_stdlib(password, salt, iterations, dklen)
    return hmac.compare_digest(dk, expected_dk)


# ---------------------------------------------------------------------------
# 2) 手写实现（教学用，展示算法内部原理）
# ---------------------------------------------------------------------------
def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    """HMAC-SHA256（RFC 2104）。"""
    block = 64
    if len(key) > block:
        key = hashlib.sha256(key).digest()
    key = key.ljust(block, b"\x00")
    inner = hashlib.sha256(bytes(x ^ 0x36 for x in key) + msg).digest()
    outer = hashlib.sha256(bytes(x ^ 0x5C for x in key) + inner).digest()
    return outer


def pbkdf2_manual(
    password: str,
    salt: bytes,
    iterations: int,
    dklen: int = KEY_LEN,
) -> bytes:
    """PBKDF2（RFC 2898）：U1 = PRF(P, S || INT(i))，U_n = PRF(P, U_{n-1})，T = XOR(U1..Uc)。"""
    pwd = password.encode("utf-8")
    hlen = 32  # SHA-256 输出字节数
    blocks = (dklen + hlen - 1) // hlen
    dk = b""
    for block in range(1, blocks + 1):
        u = hmac_sha256(pwd, salt + block.to_bytes(4, "big"))
        t = u
        for _ in range(iterations - 1):
            u = hmac_sha256(pwd, u)
            t = bytes(a ^ b for a, b in zip(t, u))
        dk += t
    return dk[:dklen]


def verify_manual(
    password: str,
    salt: bytes,
    expected_dk: bytes,
    iterations: int = ITERATIONS,
    dklen: int = KEY_LEN,
) -> bool:
    return hmac.compare_digest(pbkdf2_manual(password, salt, iterations, dklen), expected_dk)


# ---------------------------------------------------------------------------
# 3) scrypt（另一种推荐的慢哈希）
# ---------------------------------------------------------------------------
def hash_scrypt_stdlib(
    password: str,
    salt: bytes | None = None,
    n: int = 2**17,
    r: int = 8,
    p: int = 1,
) -> tuple[bytes, bytes]:
    """OWASP 推荐参数：N=2^17, r=8, p=1（交互式登录）。"""
    salt = salt if salt is not None else generate_salt()
    # N=2^17, r=8 约需 128MB 内存，需显式放开 hashlib.scrypt 的默认 maxmem(32MB)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=KEY_LEN, maxmem=256 * 1024 * 1024)
    return salt, dk


# ---------------------------------------------------------------------------
# 存储格式与解析
# ---------------------------------------------------------------------------
def encode(salt: bytes, dk: bytes, iterations: int = ITERATIONS) -> str:
    """形如 pbkdf2_sha256$310000$<salt_b64>$<hash_b64>。"""
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def decode(stored: str) -> tuple[int, bytes, bytes]:
    algo, iterations, salt_b64, hash_b64 = stored.split("$")
    if algo != "pbkdf2_sha256":
        raise ValueError(f"不支持的算法: {algo}")
    return int(iterations), base64.b64decode(salt_b64), base64.b64decode(hash_b64)


if __name__ == "__main__":
    # —— RFC 6070 风格测试向量（PBKDF2-HMAC-SHA256）——
    # P="password", S="salt", c=1
    v1 = hashlib.pbkdf2_hmac("sha256", b"password", b"salt", 1, 32).hex()
    v4096 = hashlib.pbkdf2_hmac("sha256", b"password", b"salt", 4096, 32).hex()
    print("vector c=1   :", v1)
    print("vector c=4096:", v4096)

    # —— 自检：stdlib 与手写实现输出一致 ——
    password = "example-password-123!"
    salt = generate_salt()
    _, dk_std = hash_password_stdlib(password, salt)
    dk_manual = pbkdf2_manual(password, salt, ITERATIONS)
    assert dk_std == dk_manual, "stdlib 与手写结果不一致！"
    assert verify_stdlib(password, salt, dk_std)
    assert verify_manual(password, salt, dk_manual)
    assert not verify_stdlib("wrong-password", salt, dk_std)
    print("自检通过：stdlib == 手写实现；正确口令通过、错误口令拒绝")

    # —— scrypt 自检 ——
    salt2, dk_scrypt = hash_scrypt_stdlib(password)
    assert hashlib.scrypt(password.encode(), salt=salt2, n=2**17, r=8, p=1, dklen=KEY_LEN, maxmem=256 * 1024 * 1024) == dk_scrypt
    print("scrypt 自检通过")

    # —— 存储串示例 ——
    stored = encode(salt, dk_std)
    it, s, h = decode(stored)
    assert verify_stdlib(password, s, h, it)
    print("存储串示例:", stored)
    print("盐长度:", len(salt), "字节 | 派生密钥长度:", len(dk_std), "字节 | 迭代次数:", it)
