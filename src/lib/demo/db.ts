// Contrat minimal du client Supabase utilisé par le seed/reset démo. Modélise
// le query-builder comme un thenable porteur de méthodes (.maybeSingle/.single),
// fidèle à supabase-js. Permet d'injecter supabaseAdmin en prod (cast) et un
// double en test, sans dépendre de tout le type SupabaseClient.

export type DbResponse<T> = { data: T; error: unknown };

export type MerchantRow = {
  id: string;
  slug: string | null;
  email: string | null;
  role: string | null;
};

export interface SelectBuilder
  extends PromiseLike<DbResponse<{ id: string }[] | null>> {
  eq(col: string, val: unknown): SelectBuilder;
  maybeSingle(): Promise<DbResponse<MerchantRow | null>>;
  single(): Promise<DbResponse<{ id: string } | null>>;
}

export interface InsertBuilder extends PromiseLike<DbResponse<unknown>> {
  select(cols?: string): { single(): Promise<DbResponse<{ id: string } | null>> };
}

export interface DeleteBuilder {
  in(col: string, vals: unknown[]): Promise<DbResponse<unknown>>;
  eq(col: string, val: unknown): Promise<DbResponse<unknown>>;
}

export interface DemoDb {
  from(table: string): {
    select(cols?: string): SelectBuilder;
    insert(payload: unknown): InsertBuilder;
    update(payload: unknown): { eq(col: string, val: unknown): Promise<DbResponse<unknown>> };
    delete(): DeleteBuilder;
  };
}
