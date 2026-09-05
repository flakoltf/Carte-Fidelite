// Adaptateur de stockage pour la session Supabase.
//
// expo-secure-store s'appuie sur le trousseau iOS et sur EncryptedSharedPreferences
// côté Android, qui plafonne une valeur à 2048 octets. Une session Supabase
// (access token + refresh token + user) dépasse régulièrement ce seuil : on
// découpe donc la valeur en tranches et on garde un en-tête qui dit combien.
//
// Le module est volontairement pur (le magasin est injecté) pour être testable
// sans appareil ni réseau.

export interface SecureKeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SupabaseStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Marge sous la limite Android de 2048 octets (l'en-tête et l'UTF-8 comptent). */
export const CHUNK_SIZE = 1500;

const HEADER_PREFIX = "halo.chunked.v1:";

const chunkKey = (key: string, index: number) => `${key}.${index}`;

/**
 * Découpe sans jamais couper une paire de substituts en deux (un emoji dans le
 * nom du commerce suffirait à corrompre la valeur relue).
 */
export function splitChunks(value: string, size: number = CHUNK_SIZE): string[] {
  if (size < 2) throw new Error("La taille de tranche doit valoir au moins 2.");
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + size, value.length);
    const last = value.charCodeAt(end - 1);
    // Substitut haut en fin de tranche → on recule d'un cran.
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks.length > 0 ? chunks : [""];
}

function parseHeader(raw: string): number | null {
  if (!raw.startsWith(HEADER_PREFIX)) return null;
  const count = Number.parseInt(raw.slice(HEADER_PREFIX.length), 10);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function createChunkedStorage(store: SecureKeyValueStore): SupabaseStorageAdapter {
  async function readChunkCount(key: string): Promise<number | null> {
    const raw = await store.getItemAsync(key);
    return raw === null ? null : parseHeader(raw);
  }

  async function dropChunks(key: string, from: number, to: number): Promise<void> {
    for (let i = from; i < to; i += 1) await store.deleteItemAsync(chunkKey(key, i));
  }

  return {
    async getItem(key) {
      const raw = await store.getItemAsync(key);
      if (raw === null) return null;
      const count = parseHeader(raw);
      // Valeur courte écrite avant l'introduction du découpage : on la rend telle quelle.
      if (count === null) return raw;

      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await store.getItemAsync(chunkKey(key, i));
        // Tranche manquante = valeur corrompue : mieux vaut « pas de session »
        // qu'une session tronquée (l'utilisateur se reconnecte simplement).
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join("");
    },

    async setItem(key, value) {
      const previous = await readChunkCount(key);
      const chunks = splitChunks(value);
      for (let i = 0; i < chunks.length; i += 1) {
        await store.setItemAsync(chunkKey(key, i), chunks[i] as string);
      }
      await store.setItemAsync(key, `${HEADER_PREFIX}${chunks.length}`);
      if (previous !== null && previous > chunks.length) {
        await dropChunks(key, chunks.length, previous);
      }
    },

    async removeItem(key) {
      const count = await readChunkCount(key);
      await store.deleteItemAsync(key);
      if (count !== null) await dropChunks(key, 0, count);
    },
  };
}
