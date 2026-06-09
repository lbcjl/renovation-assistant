import CryptoJS from 'crypto-js'

/**
 * Hash password using SHA-256 before sending to server
 * This adds a layer of security to prevent plaintext password transmission
 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString()
}
