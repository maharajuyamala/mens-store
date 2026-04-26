"use client";

import imageCompression from "browser-image-compression";

const COMPRESSION = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
} as const;

function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local and restart."
    );
  }
  return { cloudName, uploadPreset };
}

export type CloudinaryUploadOptions = {
  /** Cloudinary folder to place the asset in (mirrors the old Firebase `products/` prefix). */
  folder?: string;
  /** Receives upload progress as 0–100. */
  onProgress?: (pct: number) => void;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

/**
 * Compress, then upload an image to Cloudinary via the unsigned upload preset.
 * Returns the secure (https) delivery URL.
 */
export async function uploadImageToCloudinary(
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<string> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const compressed = await imageCompression(file, COMPRESSION);

  const form = new FormData();
  form.append("file", compressed);
  form.append("upload_preset", uploadPreset);
  if (options.folder) form.append("folder", options.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);

    if (options.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          options.onProgress!((e.loaded / e.total) * 100);
        }
      });
    }

    xhr.onload = () => {
      let parsed: CloudinaryUploadResponse | null = null;
      try {
        parsed = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
      } catch {
        reject(new Error(`Cloudinary returned non-JSON response (status ${xhr.status})`));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || !parsed.secure_url) {
        const message =
          parsed.error?.message ?? `Cloudinary upload failed with status ${xhr.status}`;
        reject(new Error(message));
        return;
      }
      if (options.onProgress) options.onProgress(100);
      resolve(parsed.secure_url);
    };

    xhr.onerror = () =>
      reject(new Error("Network error while uploading to Cloudinary"));

    xhr.send(form);
  });
}
