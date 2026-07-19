import { supabaseClient } from "../../../shared/lib/supabase-client";
import type { Database } from "../../../shared/types/supabase-database";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const avatarExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProfileAvatar =
  Database["public"]["Tables"]["profile_avatars"]["Row"];

export async function getMyAvatar(
  userId: string,
): Promise<ProfileAvatar | null> {
  const { data, error } = await supabaseClient
    .from("profile_avatars")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function uploadAvatarObject(
  userId: string,
  file: File,
): Promise<string> {
  const extension =
    avatarExtensions[file.type as keyof typeof avatarExtensions];

  if (!extension) {
    throw new Error("Only JPEG, PNG and WebP images are allowed");
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error("Avatar must be between 1 byte and 5 MB");
  }

  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await supabaseClient.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  return data.path;
}

export async function saveAvatarMetadata(
  userId: string,
  objectPath: string,
  file: File,
): Promise<ProfileAvatar> {
  const { data, error } = await supabaseClient
    .from("profile_avatars")
    .upsert(
      {
        user_id: userId,
        bucket_id: AVATAR_BUCKET,
        object_path: objectPath,
        mime_type: file.type,
        size_bytes: file.size,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    )
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function createAvatarSignedUrl(
  objectPath: string,
): Promise<string> {
  const { data, error } = await supabaseClient.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(objectPath, 5 * 60);

  if (error) throw error;

  return data.signedUrl;
}

export async function deleteAvatarObject(objectPath: string): Promise<void> {
  const { error } = await supabaseClient.storage
    .from(AVATAR_BUCKET)
    .remove([objectPath]);

  if (error) throw error;
}

export async function deleteAvatarMetadata(userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from("profile_avatars")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
