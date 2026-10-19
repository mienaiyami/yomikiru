import { z } from "zod";
import { I18N_NAMESPACES, type I18nNamespace, isI18nNamespace } from "./namespaces";

/** Max bytes for a single namespace JSON file inside a pack. */
export const PACK_NS_FILE_MAX_BYTES = 512 * 1024;

/** Max bytes for an install archive. */
export const PACK_ARCHIVE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Safe pack folder / id segment: letters, digits, `.`, `_`, `-` only (no path separators).
 */
export const PACK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/**
 * Single BCP-47-like locale tag for one pack (no path characters).
 */
export const PACK_LOCALE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/;

const namespaceSchema = z
    .string()
    .refine((ns): ns is I18nNamespace => isI18nNamespace(ns), { message: "unknown namespace" });

/**
 * Manifest for a user-installable translation pack (exactly one locale).
 */
export const translationPackManifestSchema = z
    .object({
        id: z.string().regex(PACK_ID_PATTERN),
        name: z.string().min(1).max(128),
        locale: z.string().regex(PACK_LOCALE_PATTERN).max(32),
        version: z.string().min(1).max(32),
        namespaces: z.array(namespaceSchema).min(1),
    })
    .strict();

export type TranslationPackManifest = z.infer<typeof translationPackManifestSchema>;

/** Known namespace set for pack allowlists (same as {@link I18N_NAMESPACES}). */
export const PACK_ALLOWED_NAMESPACES: readonly I18nNamespace[] = I18N_NAMESPACES;
