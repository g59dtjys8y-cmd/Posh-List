import { randomBytes } from 'node:crypto';

// Small dependency-free stand-in for `nanoid`: URL-safe random IDs generated
// from crypto.randomBytes. Not cryptographically "the nanoid algorithm",
// just a same-shaped unbiased-enough id generator (no npm registry access
// in this environment — see README notes in the project root report).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function nanoid(size = 21) {
  const bytes = randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}
