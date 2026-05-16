/**
 * Generates a UUID v4 using the Web Crypto API (available in Node.js 19+).
 * Replaces the `uuid` npm package.
 */
export function uuidv4(): string {
  return crypto.randomUUID()
}
