import { CLOUDINARY } from "./config.js";

export const uploadsEnabled = () => !!(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);
export const MAX_FILE_MB = 10;

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`, { method: "POST", body: fd });
  let j = {};
  try { j = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((j.error && j.error.message) || `Upload failed for ${file.name}`);
  return { name: file.name, url: j.secure_url, size: file.size };
}
