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

/**
 * Same idea as `nanoid`, but for a caller that cares about actually-uniform
 * output rather than "good enough" — `% alphabet.length` is biased toward
 * the low end of the alphabet whenever 256 isn't a multiple of its length
 * (it never is, here). Rejection sampling instead: discard any byte that
 * falls in the leftover, unevenly-sized remainder above the largest clean
 * multiple of `alphabet.length` that fits in a byte, and draw again for
 * that position. The rejection rate is small (well under 2% for any
 * alphabet length used in this app) so this converges in one or two passes
 * in practice.
 */
export function nanoidFrom(alphabet, size) {
  const maxUnbiased = 256 - (256 % alphabet.length);
  let id = '';
  while (id.length < size) {
    const bytes = randomBytes(size - id.length);
    for (let i = 0; i < bytes.length && id.length < size; i++) {
      if (bytes[i] < maxUnbiased) id += alphabet[bytes[i] % alphabet.length];
    }
  }
  return id;
}
