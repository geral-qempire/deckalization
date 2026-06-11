/**
 * Canonical card-name normalization. Casing/punctuation/diacritics-insensitive.
 *
 * IMPORTANT: agents/resolver.py (Phase 2) MUST replicate this algorithm exactly,
 * or exact-match lookups will silently miss. Algorithm:
 *   1. Unicode NFKD normalize, strip combining marks (diacritics): "Æther"->"aether-ish"
 *   2. lowercase
 *   3. drop apostrophes entirely (no space): "Urza's" -> "urzas"
 *   4. replace every other non [a-z0-9] run with a single space
 *   5. trim + collapse whitespace
 *
 * Examples:
 *   "Jace, the Mind Sculptor" -> "jace the mind sculptor"
 *   "Fire // Ice"             -> "fire ice"
 *   "Lim-Dûl's Vault"         -> "lim duls vault"
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
