import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/app/firebase";

const DOC_NAME = "_doc";

function wishlistRef(uid: string) {
  return doc(getDb(), "users", uid, "wishlist", DOC_NAME);
}

function readIds(data: DocumentData | undefined): string[] {
  if (!data) return [];
  const ids = (data as Record<string, unknown>).ids;
  if (!Array.isArray(ids)) return [];
  return ids.filter((x): x is string => typeof x === "string");
}

/**
 * Read the user's persisted wishlist and merge it with the locally-stored ids
 * (union, deduped). Caller is expected to set the resulting list into the
 * wishlist store and then call `writeRemoteWishlist` to keep them in sync.
 */
export async function mergeWishlistOnSignIn(
  uid: string,
  localIds: string[]
): Promise<string[]> {
  try {
    const snap = await getDoc(wishlistRef(uid));
    const remoteIds = snap.exists() ? readIds(snap.data()) : [];
    const merged = Array.from(new Set([...remoteIds, ...localIds]));
    if (merged.length !== remoteIds.length) {
      // Write the merged set back if local contributed new ids.
      await setDoc(
        wishlistRef(uid),
        { ids: merged, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    return merged;
  } catch (err) {
    console.warn("[wishlist] sync on sign-in failed", err);
    return localIds;
  }
}

export async function writeRemoteWishlist(
  uid: string,
  ids: string[]
): Promise<void> {
  try {
    await setDoc(
      wishlistRef(uid),
      { ids, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("[wishlist] remote write failed", err);
  }
}
