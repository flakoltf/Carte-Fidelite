import {
  CHUNK_SIZE,
  createChunkedStorage,
  splitChunks,
  type SecureKeyValueStore,
} from "../secureStorage";

/** Faux trousseau en mémoire — même contrat qu'expo-secure-store. */
function fakeStore() {
  const values = new Map<string, string>();
  const store: SecureKeyValueStore = {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  };
  return { store, values };
}

describe("splitChunks", () => {
  it("respecte la taille demandée", () => {
    expect(splitChunks("abcdefg", 3)).toEqual(["abc", "def", "g"]);
  });

  it("ne coupe jamais une paire de substituts en deux", () => {
    // 🎉 occupe deux unités de code : couper entre les deux corromprait la valeur.
    const chunks = splitChunks("ab🎉cd", 3);
    expect(chunks.join("")).toBe("ab🎉cd");
    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.normalize());
      expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/);
    }
  });

  it("renvoie une tranche vide pour une valeur vide", () => {
    expect(splitChunks("", 10)).toEqual([""]);
  });

  it("refuse une taille absurde", () => {
    expect(() => splitChunks("abc", 1)).toThrow();
  });
});

describe("createChunkedStorage", () => {
  it("relit à l'identique une session plus grosse que la limite Android de 2048 octets", async () => {
    const { store, values } = fakeStore();
    const storage = createChunkedStorage(store);
    const session = "j".repeat(5000);

    await storage.setItem("sb-session", session);

    // Aucune valeur écrite ne dépasse la limite du trousseau Android.
    for (const value of values.values()) expect(value.length).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(await storage.getItem("sb-session")).toBe(session);
  });

  it("supprime les tranches devenues inutiles quand la valeur raccourcit", async () => {
    const { store, values } = fakeStore();
    const storage = createChunkedStorage(store);

    await storage.setItem("k", "x".repeat(CHUNK_SIZE * 3));
    await storage.setItem("k", "y".repeat(10));

    expect(await storage.getItem("k")).toBe("y".repeat(10));
    expect(values.has("k.1")).toBe(false);
    expect(values.has("k.2")).toBe(false);
  });

  it("efface l'en-tête et toutes les tranches à la suppression", async () => {
    const { store, values } = fakeStore();
    const storage = createChunkedStorage(store);

    await storage.setItem("k", "z".repeat(CHUNK_SIZE * 2 + 5));
    await storage.removeItem("k");

    expect(values.size).toBe(0);
    expect(await storage.getItem("k")).toBeNull();
  });

  it("renvoie null pour une clé inconnue", async () => {
    const { store } = fakeStore();
    expect(await createChunkedStorage(store).getItem("inconnue")).toBeNull();
  });

  it("relit telle quelle une valeur écrite avant l'introduction du découpage", async () => {
    const { store, values } = fakeStore();
    values.set("legacy", "valeur-simple");
    expect(await createChunkedStorage(store).getItem("legacy")).toBe("valeur-simple");
  });

  it("préfère « pas de session » à une session tronquée", async () => {
    const { store, values } = fakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "a".repeat(CHUNK_SIZE * 2));

    values.delete("k.1"); // tranche perdue

    expect(await storage.getItem("k")).toBeNull();
  });

  it("gère les emojis à cheval sur deux tranches", async () => {
    const { store } = fakeStore();
    const storage = createChunkedStorage(store);
    const value = "🎉".repeat(CHUNK_SIZE);

    await storage.setItem("k", value);

    expect(await storage.getItem("k")).toBe(value);
  });
});
