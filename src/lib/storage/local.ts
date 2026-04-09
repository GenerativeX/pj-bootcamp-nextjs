import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  BlobItem,
  BlobProperties,
  StorageProvider,
  StreamDownloadResult,
} from "./types";

const DEFAULT_ROOT = path.join(process.cwd(), ".local-storage");

const toPosix = (value: string) => value.replace(/\\/g, "/");

const sanitize = (value: string): string => {
  const normalized = path.posix.normalize(toPosix(value)).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
};

const walkFiles = async (root: string, current = ""): Promise<string[]> => {
  const abs = current ? path.join(root, current) : root;
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const rel = current ? path.posix.join(current, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, rel)));
      continue;
    }
    if (entry.isFile()) {
      files.push(toPosix(rel));
    }
  }
  return files;
};

export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir = process.env.STORAGE_LOCAL_ROOT ?? DEFAULT_ROOT) {
    this.rootDir = rootDir;
  }

  private getContainerDir(containerName?: string): string {
    const name = sanitize(containerName ?? "default");
    return path.join(this.rootDir, name);
  }

  private getBlobPath(blobName: string, containerName?: string): string {
    const rel = sanitize(blobName);
    return path.join(this.getContainerDir(containerName), rel);
  }

  async ensureContainerExists(containerName?: string): Promise<void> {
    await mkdir(this.getContainerDir(containerName), { recursive: true });
  }

  async uploadData(
    blobName: string,
    data: Buffer,
    options: { contentType?: string; containerName?: string },
  ): Promise<void> {
    await this.ensureContainerExists(options.containerName);
    const filePath = this.getBlobPath(blobName, options.containerName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async uploadFile(
    blobName: string,
    filePath: string,
    options: { contentType?: string; containerName?: string },
  ): Promise<void> {
    await this.ensureContainerExists(options.containerName);
    const targetPath = this.getBlobPath(blobName, options.containerName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const data = await readFile(filePath);
    await writeFile(targetPath, data);
  }

  async uploadStream(
    blobName: string,
    stream: Readable,
    options: { contentType?: string; containerName?: string },
  ): Promise<void> {
    await this.ensureContainerExists(options.containerName);
    const targetPath = this.getBlobPath(blobName, options.containerName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await pipeline(stream, createWriteStream(targetPath));
  }

  async download(
    blobName: string,
    containerName?: string,
  ): Promise<StreamDownloadResult> {
    const filePath = this.getBlobPath(blobName, containerName);
    return {
      readableStreamBody: createReadStream(filePath),
      contentType: "application/octet-stream",
    };
  }

  async downloadToFile(
    blobName: string,
    filePath: string,
    containerName?: string,
  ): Promise<void> {
    const source = this.getBlobPath(blobName, containerName);
    const data = await readFile(source);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async exists(blobName: string, containerName?: string): Promise<boolean> {
    try {
      await stat(this.getBlobPath(blobName, containerName));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async deleteBlob(blobName: string, containerName?: string): Promise<void> {
    await rm(this.getBlobPath(blobName, containerName), { force: false });
  }

  async deleteIfExists(
    blobName: string,
    containerName?: string,
  ): Promise<boolean> {
    const exists = await this.exists(blobName, containerName);
    if (!exists) return false;
    await rm(this.getBlobPath(blobName, containerName), { force: true });
    return true;
  }

  async getProperties(
    blobName: string,
    containerName?: string,
  ): Promise<BlobProperties> {
    const fileStat = await stat(this.getBlobPath(blobName, containerName));
    return {
      contentLength: fileStat.size,
      contentType: "application/octet-stream",
      lastModified: fileStat.mtime,
    };
  }

  async *listBlobs(options: {
    prefix?: string;
    containerName?: string;
  }): AsyncIterable<BlobItem> {
    await this.ensureContainerExists(options.containerName);
    const containerDir = this.getContainerDir(options.containerName);
    const all = await walkFiles(containerDir);
    const prefix = options.prefix ? sanitize(options.prefix) : "";
    for (const rel of all) {
      if (prefix && !toPosix(rel).startsWith(prefix)) continue;
      const fullPath = path.join(containerDir, rel);
      const fileStat = await stat(fullPath);
      yield {
        name: toPosix(rel),
        properties: {
          contentLength: fileStat.size,
          contentType: "application/octet-stream",
          lastModified: fileStat.mtime,
        },
      };
    }
  }

  async generateUploadUrl(
    blobName: string,
    _options: { containerName?: string; expiresInMinutes?: number },
  ): Promise<{ signedUrl: string; publicUrl: string }> {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const encoded = encodeURIComponent(blobName);
    return {
      signedUrl: `${baseUrl}/api/files/${encoded}/download?localUpload=1`,
      publicUrl: `/api/files/${encoded}/download`,
    };
  }

  getBlobUrl(blobName: string, _containerName?: string): string {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return `${baseUrl}/api/files/${encodeURIComponent(blobName)}/download`;
  }
}
