import { fetchPrimeFromGamerPower } from './gamerpower.js';

/**
 * Prime Gaming — GamerPower üzerinden Amazon Prime / Prime Gaming giveaway’leri.
 * Resmi public API olmadığı için üçüncü parti giveaway feed kullanılır.
 */
export async function fetchPrimeGames() {
  return fetchPrimeFromGamerPower();
}
