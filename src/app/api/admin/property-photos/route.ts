import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
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

function getRestoreUrls(payload: unknown) {
  return getDeleteUrls(payload);
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
  const auth = await requireAdminSession("photo.write");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
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
        message: "Chaque photo doit etre une image JPG, PNG, WebP ou AVIF de moins de 8 Mo.",
      },
      { status: 400 }
    );
  }

  const bucketReady = await ensurePhotoBucket(supabase);
  if (!bucketReady) {
    return NextResponse.json(
      { success: false, message: "Le stockage des photos n'a pas pu etre prepare." },
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
        { success: false, message: "Une photo n'a pas pu etre envoyee. Merci de reessayer." },
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

  await writeAdminAuditLog(auth.session, "property_photo.upload", "property_photo", null, {
    count: uploadedPhotos.length,
  });

  return NextResponse.json({
    success: true,
    message: `${uploadedPhotos.length} photo(s) ajoutee(s).`,
    photos: uploadedPhotos,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession("photo.write");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const urls = getDeleteUrls(payload);

  if (urls.length === 0) {
    return NextResponse.json(
      { success: false, message: "Aucune photo a supprimer." },
      { status: 400 }
    );
  }

  const trashItems = Array.from(
    new Map(
      urls
        .map((url) => ({ url, path: getStoragePathFromPublicUrl(url) }))
        .filter((item): item is { url: string; path: string } => Boolean(item.path))
        .map((item) => [item.path, item])
    ).values()
  );
  const ignoredCount = urls.length - trashItems.length;

  if (trashItems.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Aucune photo Supabase du site n'a ete placee en corbeille.",
      deletedCount: 0,
      ignoredCount,
    });
  }

  const restoreUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: activePhotoError } = await supabase
    .from("property_photos")
    .update({
      status: "TRASHED",
      trashed_at: new Date().toISOString(),
      trashed_by: auth.session.user.id,
      restore_until: restoreUntil,
    })
    .in("public_url", trashItems.map((item) => item.url));

  if (activePhotoError) {
    console.error("[IMMO-DREAMS83] Property photo table trash failed", activePhotoError.message);
  }

  const { error } = await supabase.from("property_photo_trash").insert(
    trashItems.map((item) => ({
      storage_bucket: bucketName,
      storage_path: item.path,
      public_url: item.url,
      deleted_by: auth.session.user.id,
      delete_reason: "removed_from_property_gallery",
      restore_until: restoreUntil,
    }))
  );

  if (error) {
    console.error("[IMMO-DREAMS83] Property photo trash failed", error.message);
    return NextResponse.json(
      { success: false, message: "Les photos retirees n'ont pas pu etre placees en corbeille." },
      { status: 500 }
    );
  }

  await writeAdminAuditLog(auth.session, "property_photo.trash", "property_photo", null, {
    count: trashItems.length,
  });

  return NextResponse.json({
    success: true,
    message: `${trashItems.length} photo(s) placee(s) en corbeille temporaire.`,
    deletedCount: trashItems.length,
    ignoredCount,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("photo.write");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const urls = getRestoreUrls(payload);

  if (urls.length === 0) {
    return NextResponse.json(
      { success: false, message: "Aucune photo a restaurer." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error: photoError, count } = await supabase
    .from("property_photos")
    .update({
      status: "ACTIVE",
      trashed_at: null,
      trashed_by: null,
      restored_at: now,
      purged_at: null,
    }, { count: "exact" })
    .in("public_url", urls)
    .eq("status", "TRASHED");

  if (photoError) {
    console.error("[IMMO-DREAMS83] Property photo restore failed", photoError.message);
    return NextResponse.json(
      { success: false, message: "Les photos n'ont pas pu etre restaurees." },
      { status: 500 }
    );
  }

  await supabase
    .from("property_photo_trash")
    .update({ restored_at: now })
    .in("public_url", urls)
    .is("restored_at", null);

  await writeAdminAuditLog(auth.session, "property_photo.restore", "property_photo", null, {
    count: count ?? 0,
  });

  return NextResponse.json({
    success: true,
    message: `${count ?? 0} photo(s) restauree(s).`,
    restoredCount: count ?? 0,
  });
}
