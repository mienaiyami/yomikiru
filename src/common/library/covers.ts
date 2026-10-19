/**
 * Filenames for managed WebP thumbnails under `userData/covers/`.
 * Main and renderer join this onto the covers directory with their own path APIs.
 *
 * `library` is the chapter/folder/user-pick thumbnail. `tracker` is remote tracker art.
 * Separate files so Reset Cover / delete of the library slot does not drop tracker art.
 */
export type ManagedCoverSlot = "library" | "tracker";

/**
 * WebP filename for a library row id and {@link ManagedCoverSlot}.
 */
export const managedCoverFileName = (libraryId: number, slot: ManagedCoverSlot = "library"): string =>
    slot === "tracker" ? `tracker-${libraryId}.webp` : `${libraryId}.webp`;
