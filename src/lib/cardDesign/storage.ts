import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET = 'card-assets';

export function applePath(merchantId: string, name: string) {
  return `${merchantId}/apple/${name}`;
}

export function googlePath(merchantId: string, name: string) {
  return `${merchantId}/google/${name}`;
}

export async function uploadAsset(path: string, body: Buffer, contentType = 'image/png') {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return path;
}

export async function downloadAsset(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`signedUrl ${path}: ${error?.message}`);
  return data.signedUrl;
}
