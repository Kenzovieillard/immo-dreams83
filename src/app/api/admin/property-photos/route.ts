import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

const bucketName = "property-photos";
const maxFiles = 12;
const maxFileSize = 8 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type UploadedPhoto = {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
};

function getDeleteUrls(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("urls" in payload)) return [];

  const urls = (payload as { urls?: unknown }).urls;
  if (!Array.isArray(urls)) return [];

  return urls
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);
}

function isAuthorized(request: NextRequest) {
  const expectedCode = process.env.NEXT_PUBLIC_ADMIN_LOCAL_CODE;
  return Boolean(expectedCode && request.headers.get("x-admin-code") === expectedCode);
}

function getStoragePathFromPublicUrl(photoUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const expectedUrl = new URL(supabaseUrl);
    const publicUrl = new URL(photoUrl);
    const publicPathPrefix = `/storage/v1/object/public/${bucketName}/`;

    if (publicUrl.hostname !== expectedUrl.hostname) return null;
    if (!publicUrl.pathname.startsWith(publicPathPrefix)) return null;

    const storagePath = decodeURIComponent(publicUrl.pathname.slice(publicPathPrefix.length));
    if (!storagePath || storagePath.startsWith("/") || storagePath.includes("..")) return null;
    if (!storagePath.startsWith("properties/")) return null;

    return storagePath;
  } catch {
    return null;
  }
}

function getFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();
  if (extensionFromName && /^[a-z0-9]+$/.test(extensionFromName)) return extensionFromName;

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/avif") return "avif";

  return "jpg";
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "photo";
}

async function ensurePhotoBucket(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return false;

  const { error: getBucketError } = await supabase.storage.getBucket(bucketName);
  if (!getBucketError) return true;

  const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    allowedMimeTypes,
    fileSizeLimit: String(maxFileSize),
  });

  return !createBucketError;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const files = formData?.getAll("photos").filter((item): item is File => item instanceof File) ?? [];

  if (files.length === 0) {
    return NextResponse.json({ success: false, message: "Ajoutez au moins une photo." }, { status: 400 });
  }

  if (files.length > maxFiles) {
    return NextResponse.json({ success: false, message: `Maximum ${maxFiles} photos par bien.` }, { status: 400 });
  }

  const invalidFile = files.find((file) => !allowedMimeTypes.includes(file.type) || file.size > maxFileSize);
  if (invalidFile) {
    return NextResponse.json(
      {
        success: false,
        message: "Chaque photo doit être une image JPG, PNG, WebP ou AVIF de moins de 8 Mo.",
      },
      { status: 400 }
    );
  }

  const bucketReady = await ensurePhotoBucket(supabase);
  if (!bucketReady) {
    return NextResponse.json(
      { success: false, message: "Le stockage des photos n'a pas pu être préparé." },
      { status: 500 }
    );
  }

  const uploadedPhotos: UploadedPhoto[] = [];
  const datePrefix = new Date().toISOString().slice(0, 10);

  for (const file of files) {
    const extension = getFileExtension(file);
    const fileName = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}.${extension}`;
    const path = `properties/${datePrefix}/${fileName}`;
    const { error } = await supabase.storage.from(bucketName).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      console.error("[IMMO-DREAMS83] Property photo upload failed", error.message);
      return NextResponse.json(
        { success: false, message: "Une photo n'a pas pu être envoyée. Merci de réessayer." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    uploadedPhotos.push({
      url: data.publicUrl,
      path,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  }

  return NextResponse.json({
    success: true,
    message: `${uploadedPhotos.length} photo(s) ajoutée(s).`,
    photos: uploadedPhotos,
  });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const urls = getDeleteUrls(payload);

  if (urls.length === 0) {
    return NextResponse.json(
      { success: false, message: "Aucune photo à supprimer." },
      { status: 400 }
    );
  }

  const paths = Array.from(
    new Set(
      urls
        .map((url) => getStoragePathFromPublicUrl(url))
        .filter((path): path is string => Boolean(path))
    )
  );
  const ignoredCount = urls.length - paths.length;

  if (paths.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Aucune photo Supabase du site n'a été supprimée.",
      deletedCount: 0,
      ignoredCount,
    });
  }

  const { data, error } = await supabase.storage.from(bucketName).remove(paths);

  if (error) {
    console.error("[IMMO-DREAMS83] Property photo delete failed", error.message);
    return NextResponse.json(
      { success: false, message: "Les photos supprimées de la fiche n'ont pas pu être retirées du stockage." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${data?.length ?? paths.length} photo(s) supprimée(s) du stockage Supabase.`,
    deletedCount: data?.length ?? paths.length,
    ignoredCount,
  });
}
