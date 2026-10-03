import { randomBytes } from 'node:crypto';
import { argon2Verify, argon2id } from 'hash-wasm';

// WASM thay vì native binding `argon2` — file .node native bị Windows Smart
// App Control chặn (unsigned binary) trên máy dev. Tham số khớp default cũ
// của package `argon2` (memoryCost=65536 KiB, timeCost=3, parallelism=4,
// hashLength=32) để hash cũ trong DB vẫn verify được bình thường — đã verify
// chiều parse bằng hash thật trong DB trước khi đổi.
const MEMORY_SIZE_KIB = 65536;
const ITERATIONS = 3;
const PARALLELISM = 4;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

export function hash(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(SALT_LENGTH),
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_SIZE_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });
}

export function verify(digest: string, password: string): Promise<boolean> {
  return argon2Verify({ password, hash: digest });
}
