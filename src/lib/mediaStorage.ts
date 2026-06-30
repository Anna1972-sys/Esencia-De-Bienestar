import { supabase } from "@/integrations/supabase/client";

const STORAGE_REF_PREFIX = "storage://";

export function makeStorageRef(bucket: string, path: string) {
  return `${STORAGE_REF_PREFIX}${bucket}/${path.replace(/^\/+/, "")}`;
}

export function parseStorageRef(value?: string | null): { bucket: string; path: string } | null {
  if (!value) return null;
  if (value.startsWith(STORAGE_REF_PREFIX)) {
    const rest = value.slice(STORAGE_REF_PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
  }

  const match = value.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/?#]+)\/([^?#]+)/);
  if (!match) return null;
  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  };
}

export function mediaUrl(value?: string | null) {
  if (!value) return "";
  const ref = parseStorageRef(value);
  if (!ref) return value;
  return supabase.storage.from(ref.bucket).getPublicUrl(ref.path).data.publicUrl;
}

export function mediaUrls(values?: string[] | null) {
  return (values ?? []).map(mediaUrl).filter(Boolean);
}

function adminRoleCheckSqlComment() {
  return "Storage uploads require an authenticated admin session.";
}

export async function uploadMediaToStorage(bucket: string, folder: string, file: File) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("[storage] No se pudo comprobar la sesión antes de subir archivo", {
      bucket,
      folder,
      error: sessionError.message,
    });
    throw new Error("No se pudo comprobar la sesión antes de subir el archivo.");
  }
  if (!sessionData.session?.access_token) {
    console.error("[storage] Subida bloqueada: no hay sesión autenticada", {
      bucket,
      folder,
      requirement: adminRoleCheckSqlComment(),
    });
    throw new Error("Sesión no válida. Cierra sesión, vuelve a entrar e inténtalo de nuevo.");
  }

  const ext = file.name.split(".").pop() || "bin";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder.replace(/^\/+|\/+$/g, "")}/${crypto.randomUUID()}-${safeName || `archivo.${ext}`}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) {
    console.error("[storage] Error al subir archivo", {
      bucket,
      folder,
      path,
      message: error.message,
      name: error.name,
    });
    if (/bucket not found/i.test(error.message)) {
      throw new Error(`No se pudo subir el archivo: el bucket "${bucket}" no está disponible para esta sesión.`);
    }
    throw error;
  }
  return makeStorageRef(bucket, path);
}

export function isEmbeddableVideo(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}

export function videoEmbedUrlFromMedia(value?: string | null): string | null {
  const url = mediaUrl(value);
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function videoThumbnailFromMedia(value?: string | null): string | null {
  const url = mediaUrl(value);
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  return null;
}
