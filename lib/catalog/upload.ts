// lib/catalog/upload.ts
import { supabase } from "@/lib/supabaseClient";

const CATALOG_BUCKET = "item-images";

export async function uploadToBucket(file: File, folder: string): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = (ext || "jpg").toLowerCase();
  const filePath = `${folder}/${crypto.randomUUID()}.${safeExt}`;

  const { error: uploadErr } = await supabase.storage.from(CATALOG_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from(CATALOG_BUCKET).getPublicUrl(filePath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error("Upload succeeded but public URL could not be generated.");

  return publicUrl;
}
