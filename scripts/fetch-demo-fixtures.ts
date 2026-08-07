/**
 * Populates the gitignored `demo/` library for local development.
 * Dev-only: never packaged with releases. Run via `pnpm demo:setup`.
 *
 * Generates synthetic comic pages (PNG/CBZ/PDF) and downloads pinned
 * IDPF EPUB 3 samples + open-license comic assets from the manifest.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const ROOT = path.resolve(process.cwd());
const DEMO_ROOT = path.join(ROOT, "demo");
const MANIFEST_PATH = path.join(ROOT, "scripts", "demo-fixtures.manifest.json");
const CHECKSUMS_PATH = path.join(ROOT, "scripts", "demo-fixtures.checksums.json");

type ManifestDownload = {
    id: string;
    title: string;
    url: string;
    dest: string;
    license: string;
    sourceUrl: string;
    notes?: string;
};

type Manifest = {
    version: number;
    description: string;
    epubs: ManifestDownload[];
    images: ManifestDownload[];
    archives: ManifestDownload[];
};

type ChecksumsFile = {
    /** sha256 hex keyed by manifest id */
    hashes: Record<string, string>;
};

type Rgb = { r: number; g: number; b: number };

const UPDATE_CHECKSUMS = process.argv.includes("--update-checksums");

const ensureDir = (dir: string): void => {
    fs.mkdirSync(dir, { recursive: true });
};

/**
 * Bridges Node Buffer vs Uint8Array typing under newer @types/node.
 */
const asBytes = (buf: Buffer | Uint8Array): Uint8Array =>
    new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);

const toBuffer = (data: Buffer | Uint8Array): Buffer =>
    Buffer.from(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);

/** Concatenate Buffers without hitting Buffer/Uint8Array assignability errors. */
const concatBuf = (...parts: Buffer[]): Buffer =>
    toBuffer(Buffer.concat(parts.map(asBytes)) as unknown as Uint8Array);

const writeBuf = (filePath: string, data: Buffer): void => {
    fs.writeFileSync(filePath, asBytes(data));
};

const deflateBuf = (data: Buffer): Buffer => toBuffer(deflateSync(asBytes(data)) as unknown as Uint8Array);

const inflateBuf = (data: Buffer): Buffer => toBuffer(inflateSync(asBytes(data)) as unknown as Uint8Array);

/**
 * CRC32 for ZIP local headers / central directory (IEEE polynomial).
 */
const crc32Table = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();

const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
};

/**
 * Builds a minimal RGB PNG (8-bit, no alpha) with zlib-compressed IDAT.
 */
const createRgbPng = (width: number, height: number, fillPixel: (x: number, y: number) => Rgb): Buffer => {
    const stride = 1 + width * 3;
    const raw = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const rowStart = y * stride;
        raw[rowStart] = 0; // filter: None
        for (let x = 0; x < width; x++) {
            const { r, g, b } = fillPixel(x, y);
            const i = rowStart + 1 + x * 3;
            raw[i] = r;
            raw[i + 1] = g;
            raw[i + 2] = b;
        }
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 2; // RGB
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;

    const chunk = (type: string, data: Buffer): Buffer => {
        const typeBuf = Buffer.from(type, "ascii");
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc32(concatBuf(typeBuf, data)), 0);
        return concatBuf(len, typeBuf, data, crcBuf);
    };

    return concatBuf(
        signature,
        chunk("IHDR", ihdrData),
        chunk("IDAT", deflateBuf(raw)),
        chunk("IEND", Buffer.alloc(0)),
    );
};

/**
 * Manga-like portrait page with panel grid and chapter/page labels as color bars.
 */
const createPagedMangaPng = (pageIndex: number, chapter: number, width = 900, height = 1300): Buffer => {
    const bg: Rgb = { r: 245, g: 242, b: 235 };
    const ink: Rgb = { r: 28, g: 28, b: 32 };
    const accents: Rgb[] = [
        { r: 70, g: 120, b: 180 },
        { r: 180, g: 90, b: 70 },
        { r: 90, g: 150, b: 100 },
        { r: 140, g: 100, b: 170 },
    ];
    const accent = accents[(chapter + pageIndex) % accents.length];
    const panelGap = 12;
    const margin = 40;
    const rows = 3;
    const cols = 2;
    const panelW = Math.floor((width - margin * 2 - panelGap * (cols - 1)) / cols);
    const panelH = Math.floor((height - margin * 2 - 80 - panelGap * (rows - 1)) / rows);

    return createRgbPng(width, height, (x, y) => {
        // header bar
        if (y < 36) {
            const t = (pageIndex + 1) / 20;
            return {
                r: Math.floor(ink.r + (accent.r - ink.r) * t),
                g: Math.floor(ink.g + (accent.g - ink.g) * t),
                b: Math.floor(ink.b + (accent.b - ink.b) * t),
            };
        }
        // footer page marker strip
        if (y > height - 28) {
            const on = Math.floor(x / 18) % 2 === pageIndex % 2;
            return on ? accent : ink;
        }
        // panel grid
        const ix = x - margin;
        const iy = y - margin - 40;
        if (ix < 0 || iy < 0) return bg;
        const col = Math.floor(ix / (panelW + panelGap));
        const row = Math.floor(iy / (panelH + panelGap));
        if (col < 0 || col >= cols || row < 0 || row >= rows) return bg;
        const px = ix - col * (panelW + panelGap);
        const py = iy - row * (panelH + panelGap);
        if (px >= panelW || py >= panelH) return bg;
        // panel border
        if (px < 3 || py < 3 || px >= panelW - 3 || py >= panelH - 3) return ink;
        // diagonal hatch per panel for visual variety
        const hatch = (px + py + col * 7 + row * 13 + pageIndex * 3) % 14 < 2;
        if (hatch) return accent;
        return bg;
    });
};

/**
 * Tall webtoon-style strip with repeating horizontal bands.
 */
const createLongStripPng = (pageIndex: number, chapter: number, width = 800, height = 4200): Buffer => {
    const bands: Rgb[] = [
        { r: 232, g: 240, b: 248 },
        { r: 248, g: 236, b: 228 },
        { r: 236, g: 244, b: 232 },
        { r: 244, g: 232, b: 244 },
    ];
    const ink: Rgb = { r: 40, g: 44, b: 52 };
    const bandH = 280;

    return createRgbPng(width, height, (x, y) => {
        const band = Math.floor(y / bandH);
        const base = bands[(band + chapter) % bands.length];
        // side gutters
        if (x < 24 || x > width - 24) return ink;
        // speech-bubble-ish rounded blocks
        const localY = y % bandH;
        const cx = width / 2 + ((band + pageIndex) % 3) * 40 - 40;
        const cy = bandH / 2;
        const dx = (x - cx) / 220;
        const dy = (localY - cy) / 70;
        if (dx * dx + dy * dy < 1) {
            return { r: 255, g: 255, b: 255 };
        }
        // progress tick every 40px
        if (x > width - 40 && y % 40 < 2) return ink;
        return base;
    });
};

/**
 * Writes a ZIP (STORE method) archive — enough for CBZ readers.
 */
const writeZipStore = (zipPath: string, files: { name: string; data: Buffer }[]): void => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
        const nameBuf = Buffer.from(file.name, "utf8");
        const crc = crc32(file.data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0, 6); // flags
        local.writeUInt16LE(0, 8); // STORE
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(file.data.length, 18);
        local.writeUInt32LE(file.data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);

        const localFull = concatBuf(local, nameBuf, file.data);
        localParts.push(localFull);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10); // STORE
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(file.data.length, 20);
        central.writeUInt32LE(file.data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(concatBuf(central, nameBuf));

        offset += localFull.length;
    }

    const centralDir = concatBuf(...centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralDir.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    ensureDir(path.dirname(zipPath));
    writeBuf(zipPath, concatBuf(...localParts, centralDir, end));
};

/**
 * Builds a minimal multi-page PDF with embedded raw RGB images (FlateDecode).
 * Each entry in `rgbPages` must be `pageWidth * pageHeight * 3` bytes.
 */
const createImagePdf = (rgbPages: Buffer[], pageWidth: number, pageHeight: number): Buffer => {
    const objects: Buffer[] = [];
    const offsets: number[] = [];
    const pageObjNums: number[] = [];
    const imageObjNums: number[] = [];
    const contentObjNums: number[] = [];
    const kids: string[] = [];

    const addObject = (body: Buffer): number => {
        objects.push(body);
        return objects.length;
    };

    for (let i = 0; i < rgbPages.length; i++) {
        const compressed = deflateBuf(rgbPages[i]);
        const imgNum = addObject(
            concatBuf(
                Buffer.from(
                    `<< /Type /XObject /Subtype /Image /Width ${pageWidth} /Height ${pageHeight} ` +
                        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
                        `/Length ${compressed.length} >>\nstream\n`,
                    "utf8",
                ),
                compressed,
                Buffer.from("\nendstream", "utf8"),
            ),
        );
        imageObjNums[i] = imgNum;

        /* flip Y: PDF image samples originate at bottom-left */
        const content = `q ${pageWidth} 0 0 ${-pageHeight} 0 ${pageHeight} cm /Im${i} Do Q`;
        const contentNum = addObject(
            Buffer.from(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`, "utf8"),
        );
        contentObjNums[i] = contentNum;

        const pageNum = addObject(
            Buffer.from(
                `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
                    `/Contents ${contentNum} 0 R /Resources << /XObject << /Im${i} ${imgNum} 0 R >> >> >>`,
                "utf8",
            ),
        );
        pageObjNums[i] = pageNum;
        kids.push(`${pageNum} 0 R`);
    }

    const pagesObjNum = addObject(
        Buffer.from(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${rgbPages.length} >>`, "utf8"),
    );

    for (let i = 0; i < pageObjNums.length; i++) {
        const n = pageObjNums[i];
        objects[n - 1] = Buffer.from(
            `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
                `/Contents ${contentObjNums[i]} 0 R /Resources << /XObject << /Im${i} ${imageObjNums[i]} 0 R >> >> >>`,
            "utf8",
        );
    }

    const catalogNum = addObject(Buffer.from(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`, "utf8"));

    let pdf = Buffer.from("%PDF-1.4\n", "utf8");
    for (let i = 0; i < objects.length; i++) {
        offsets[i] = pdf.length;
        pdf = concatBuf(
            pdf,
            Buffer.from(`${i + 1} 0 obj\n`, "utf8"),
            objects[i],
            Buffer.from("\nendobj\n", "utf8"),
        );
    }

    const xrefOffset = pdf.length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 0; i < objects.length; i++) {
        xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    const trailer =
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`;

    return concatBuf(pdf, Buffer.from(xref, "utf8"), Buffer.from(trailer, "utf8"));
};

/**
 * Raw RGB buffer for a paged manga page (for PDF embedding).
 * Decodes the PNG produced by {@link createPagedMangaPng}.
 */
const createPagedMangaRgb = (pageIndex: number, chapter: number, width = 900, height = 1300): Buffer => {
    const sample = createPagedMangaPng(pageIndex, chapter, width, height);
    let offset = 8;
    const idatParts: Buffer[] = [];
    while (offset < sample.length) {
        const len = sample.readUInt32BE(offset);
        const type = sample.toString("ascii", offset + 4, offset + 8);
        const data = sample.subarray(offset + 8, offset + 8 + len);
        if (type === "IDAT") idatParts.push(data);
        if (type === "IEND") break;
        offset += 12 + len;
    }
    const raw = asBytes(inflateBuf(concatBuf(...idatParts)));
    const buf = Buffer.alloc(width * height * 3);
    const out = asBytes(buf);
    const stride = 1 + width * 3;
    for (let y = 0; y < height; y++) {
        const srcStart = y * stride + 1;
        out.set(raw.subarray(srcStart, srcStart + width * 3), y * width * 3);
    }
    return buf;
};

const sha256File = (filePath: string): string => {
    const hash = createHash("sha256");
    hash.update(asBytes(fs.readFileSync(filePath)));
    return hash.digest("hex");
};

const sha256Buffer = (buf: Buffer): string => createHash("sha256").update(asBytes(buf)).digest("hex");

const loadChecksums = (): ChecksumsFile => {
    if (!fs.existsSync(CHECKSUMS_PATH)) return { hashes: {} };
    return JSON.parse(fs.readFileSync(CHECKSUMS_PATH, "utf8")) as ChecksumsFile;
};

const saveChecksums = (checksums: ChecksumsFile): void => {
    writeBuf(CHECKSUMS_PATH, Buffer.from(`${JSON.stringify(checksums, null, 4)}\n`, "utf8"));
};

/**
 * Rejects HTML interstitial / error pages that some hosts return with HTTP 200.
 */
const assertBinaryPayload = (item: ManifestDownload, data: Buffer, contentType: string | null): void => {
    const head = data.subarray(0, 16).toString("utf8").trimStart().toLowerCase();
    if (
        head.startsWith("<!doctype") ||
        head.startsWith("<html") ||
        (contentType?.includes("text/html") ?? false)
    ) {
        throw new Error(`Got HTML instead of binary for ${item.id} (url may have moved)`);
    }
    const ext = path.extname(item.dest).toLowerCase();
    if ((ext === ".epub" || ext === ".cbz" || ext === ".zip") && !(data[0] === 0x50 && data[1] === 0x4b)) {
        throw new Error(`Expected ZIP/EPUB magic for ${item.id}`);
    }
    if (ext === ".cbr" && data.length < 16) {
        throw new Error(`CBR payload too small for ${item.id}`);
    }
};

/**
 * Downloads a URL to dest under demo/, verifying sha256 when pinned.
 * Never throws for network/host failures — warns and skips so setup stays usable.
 */
const downloadPinned = async (item: ManifestDownload, checksums: ChecksumsFile): Promise<boolean> => {
    const destPath = path.join(DEMO_ROOT, item.dest);
    ensureDir(path.dirname(destPath));
    const expected = checksums.hashes[item.id];

    if (fs.existsSync(destPath) && expected) {
        if (sha256File(destPath) === expected) {
            console.log(`  skip  ${item.dest} (checksum ok)`);
            return true;
        }
        console.warn(`  re-download ${item.dest} (checksum mismatch)`);
    } else if (fs.existsSync(destPath) && !expected) {
        console.log(`  keep  ${item.dest} (local file, no pinned checksum yet)`);
        if (UPDATE_CHECKSUMS) checksums.hashes[item.id] = sha256File(destPath);
        return true;
    }

    console.log(`  get   ${item.id}`);
    console.log(`        ${item.url}`);

    try {
        const res = await fetch(item.url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; YomikiruDemoFixtures/1.0; +https://github.com/mienaiyami/yomikiru)",
                Accept: "application/epub+zip,application/octet-stream,*/*",
            },
            redirect: "follow",
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = Buffer.from(await res.arrayBuffer());
        assertBinaryPayload(item, data, res.headers.get("content-type"));
        const hash = sha256Buffer(data);

        if (expected && hash !== expected && !UPDATE_CHECKSUMS) {
            throw new Error(`Checksum mismatch for ${item.id}: expected ${expected}, got ${hash}`);
        }

        writeBuf(destPath, data);
        if (!expected || UPDATE_CHECKSUMS) {
            checksums.hashes[item.id] = hash;
            console.log(`        sha256 ${hash}`);
        }
        console.log(`  ok    ${item.dest} (${data.length} bytes)`);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`  WARN  skip ${item.id}: ${message}`);
        if (item.dest.endsWith(".cbr")) {
            console.warn("        CBR testing needs this file and system unrar support.");
        }
        return false;
    }
};

const writePngChapter = (dir: string, count: number, kind: "paged" | "longstrip", chapter: number): string[] => {
    ensureDir(dir);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        const name = `page_${String(i + 1).padStart(3, "0")}.png`;
        const filePath = path.join(dir, name);
        const data = kind === "paged" ? createPagedMangaPng(i, chapter) : createLongStripPng(i, chapter);
        writeBuf(filePath, data);
        names.push(name);
    }
    return names;
};

/** Packs image files from a directory into a CBZ (ZIP/STORE). */
const writeCbzFromFiles = (cbzPath: string, imageDir: string, names: string[]): void => {
    const files = names.map((name) => ({
        name,
        data: fs.readFileSync(path.join(imageDir, name)),
    }));
    writeZipStore(cbzPath, files);
};

/**
 * Assembles MixedFormats Ch04.pdf from generated RGB page buffers.
 */
const writePdfChapter = (pdfPath: string, pageCount: number, chapter: number): void => {
    const width = 900;
    const height = 1300;
    const pages: Buffer[] = [];
    for (let i = 0; i < pageCount; i++) {
        pages.push(createPagedMangaRgb(i, chapter, width, height));
    }
    ensureDir(path.dirname(pdfPath));
    writeBuf(pdfPath, createImagePdf(pages, width, height));
};

const copyIntoChapter = (srcFiles: string[], destDir: string): void => {
    ensureDir(destDir);
    for (const src of srcFiles) {
        const base = path.basename(src);
        fs.copyFileSync(src, path.join(destDir, base));
    }
};

const generateSyntheticComics = (): void => {
    console.log("\nGenerating synthetic comics…");

    // FakeManga_Paged
    const mangaRoot = path.join(DEMO_ROOT, "comics", "FakeManga_Paged");
    const ch01 = path.join(mangaRoot, "Ch01_Images");
    const ch03 = path.join(mangaRoot, "Ch03_Images");
    const ch01Names = writePngChapter(ch01, 8, "paged", 1);
    writePngChapter(ch03, 6, "paged", 3);
    const ch02Tmp = path.join(mangaRoot, "_tmp_ch02");
    const ch02Names = writePngChapter(ch02Tmp, 7, "paged", 2);
    writeCbzFromFiles(path.join(mangaRoot, "Ch02_CBZ.cbz"), ch02Tmp, ch02Names);
    fs.rmSync(ch02Tmp, { recursive: true, force: true });
    console.log(`  FakeManga_Paged (${ch01Names.length} + cbz + Ch03)`);

    // FakeWebtoon_LongStrip
    const webRoot = path.join(DEMO_ROOT, "comics", "FakeWebtoon_LongStrip");
    const wCh01 = path.join(webRoot, "Ch01");
    writePngChapter(wCh01, 3, "longstrip", 1);
    const wTmp = path.join(webRoot, "_tmp_ch02");
    const wNames = writePngChapter(wTmp, 2, "longstrip", 2);
    writeCbzFromFiles(path.join(webRoot, "Ch02_CBZ.cbz"), wTmp, wNames);
    fs.rmSync(wTmp, { recursive: true, force: true });
    console.log("  FakeWebtoon_LongStrip");

    // MixedFormats fake chapters (images + cbz + pdf); cbr downloaded separately
    const mixed = path.join(DEMO_ROOT, "comics", "MixedFormats_OneTitle");
    const mCh01 = path.join(mixed, "Ch01_Images");
    writePngChapter(mCh01, 5, "paged", 1);
    const mTmp = path.join(mixed, "_tmp_ch02");
    const mNames = writePngChapter(mTmp, 5, "paged", 2);
    writeCbzFromFiles(path.join(mixed, "Ch02.cbz"), mTmp, mNames);
    fs.rmSync(mTmp, { recursive: true, force: true });
    writePdfChapter(path.join(mixed, "Ch04.pdf"), 4, 4);
    console.log("  MixedFormats_OneTitle (images, cbz, pdf)");
};

const assembleOpenComics = (): void => {
    console.log("\nAssembling open-license comic chapters…");

    const pagedSrc = path.join(DEMO_ROOT, "comics", "_sources", "open_paged");
    const stripSrc = path.join(DEMO_ROOT, "comics", "_sources", "open_longstrip");

    const pagedFiles = fs.existsSync(pagedSrc)
        ? fs
              .readdirSync(pagedSrc)
              .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
              .sort()
              .map((f) => path.join(pagedSrc, f))
        : [];

    const stripFiles = fs.existsSync(stripSrc)
        ? fs
              .readdirSync(stripSrc)
              .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
              .sort()
              .map((f) => path.join(stripSrc, f))
        : [];

    const openPaged = path.join(DEMO_ROOT, "comics", "OpenComic_Paged");
    if (pagedFiles.length >= 2) {
        const mid = Math.ceil(pagedFiles.length / 2);
        const ch1 = pagedFiles.slice(0, mid);
        const ch2 = pagedFiles.slice(mid);
        copyIntoChapter(ch1, path.join(openPaged, "Ch01_Images"));
        const tmp = path.join(openPaged, "_tmp_ch02");
        copyIntoChapter(ch2.length > 0 ? ch2 : ch1, tmp);
        const names = fs.readdirSync(tmp).sort();
        writeCbzFromFiles(path.join(openPaged, "Ch02_CBZ.cbz"), tmp, names);
        // CBZ writer reads binary as-is; jpeg filenames are fine
        fs.rmSync(tmp, { recursive: true, force: true });
        console.log(`  OpenComic_Paged (${pagedFiles.length} source pages)`);
    } else {
        console.warn("  WARN  OpenComic_Paged skipped (need >= 2 downloaded page images)");
    }

    const openStrip = path.join(DEMO_ROOT, "comics", "OpenWebtoon_LongStrip");
    if (stripFiles.length >= 2) {
        const mid = Math.ceil(stripFiles.length / 2);
        copyIntoChapter(stripFiles.slice(0, mid), path.join(openStrip, "Ch01"));
        copyIntoChapter(stripFiles.slice(mid), path.join(openStrip, "Ch02"));
        console.log(`  OpenWebtoon_LongStrip (${stripFiles.length} source images)`);
    } else {
        console.warn("  WARN  OpenWebtoon_LongStrip skipped (need >= 2 downloaded images)");
    }
};

const writeLicenseSources = (manifest: Manifest): void => {
    const lines: string[] = [
        "# Demo fixture license sources",
        "",
        "> Generated by `pnpm demo:setup`. Dev-only library — **not distributed** with Yomikiru installs.",
        "",
        "## Generated assets",
        "",
        "Synthetic PNGs, CBZ archives, and PDF under `comics/FakeManga_Paged`,",
        "`comics/FakeWebtoon_LongStrip`, and parts of `comics/MixedFormats_OneTitle`",
        "are **generated for Yomikiru development; no third-party copyright**.",
        "",
        "## Downloaded EPUBs",
        "",
        "EPUB files under `books/` are a curated subset of IDPF/W3C EPUB 3 samples",
        "(https://github.com/IDPF/epub3-samples) with clear open licenses only.",
        "",
    ];

    for (const item of manifest.epubs) {
        lines.push(`### ${item.title}`);
        lines.push("");
        lines.push(`- **id:** \`${item.id}\``);
        lines.push(`- **path:** \`${item.dest}\``);
        lines.push(`- **license:** ${item.license}`);
        lines.push(`- **source:** ${item.sourceUrl}`);
        lines.push(`- **download:** ${item.url}`);
        if (item.notes) lines.push(`- **notes:** ${item.notes}`);
        lines.push("");
    }

    lines.push("## Downloaded images");
    lines.push("");
    for (const item of manifest.images) {
        lines.push(`### ${item.title}`);
        lines.push("");
        lines.push(`- **id:** \`${item.id}\``);
        lines.push(`- **path:** \`${item.dest}\``);
        lines.push(`- **license:** ${item.license}`);
        lines.push(`- **source:** ${item.sourceUrl}`);
        lines.push(`- **download:** ${item.url}`);
        if (item.notes) lines.push(`- **notes:** ${item.notes}`);
        lines.push("");
    }

    lines.push("## Downloaded archives");
    lines.push("");
    for (const item of manifest.archives) {
        lines.push(`### ${item.title}`);
        lines.push("");
        lines.push(`- **id:** \`${item.id}\``);
        lines.push(`- **path:** \`${item.dest}\``);
        lines.push(`- **license:** ${item.license}`);
        lines.push(`- **source:** ${item.sourceUrl}`);
        lines.push(`- **download:** ${item.url}`);
        if (item.notes) lines.push(`- **notes:** ${item.notes}`);
        lines.push("");
    }

    writeBuf(path.join(DEMO_ROOT, "LICENSE-SOURCES.md"), Buffer.from(`${lines.join("\n")}\n`, "utf8"));
    console.log("\nWrote demo/LICENSE-SOURCES.md");
};

const main = async (): Promise<void> => {
    console.log("Yomikiru demo fixtures (dev-only, not shipped with releases)");
    console.log(`Demo root: ${DEMO_ROOT}`);

    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error(`Missing manifest: ${MANIFEST_PATH}`);
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
    const checksums = loadChecksums();
    let downloadFailures = 0;

    ensureDir(DEMO_ROOT);
    // keep .gitkeep
    if (!fs.existsSync(path.join(DEMO_ROOT, ".gitkeep"))) {
        writeBuf(path.join(DEMO_ROOT, ".gitkeep"), Buffer.alloc(0));
    }

    generateSyntheticComics();

    console.log("\nDownloading EPUBs…");
    for (const item of manifest.epubs) {
        if (!(await downloadPinned(item, checksums))) downloadFailures += 1;
    }

    console.log("\nDownloading open images…");
    for (const item of manifest.images) {
        if (!(await downloadPinned(item, checksums))) downloadFailures += 1;
    }

    console.log("\nDownloading archives (CBR)…");
    for (const item of manifest.archives) {
        if (!(await downloadPinned(item, checksums))) downloadFailures += 1;
    }

    assembleOpenComics();
    writeLicenseSources(manifest);

    if (UPDATE_CHECKSUMS || Object.keys(checksums.hashes).length > 0) {
        saveChecksums(checksums);
        console.log(`Checksums: ${CHECKSUMS_PATH}`);
    }

    if (downloadFailures > 0) {
        console.warn(
            `\n${downloadFailures} download(s) skipped (network/host/checksum). Generated fixtures are still ready.`,
        );
    }

    console.log("\nDone.");
    console.log(`Add this folder as a library location (or default location) in Settings:`);
    console.log(`  ${DEMO_ROOT}`);
    console.log("This content is for developers only and is never packaged with the app.");
};

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
