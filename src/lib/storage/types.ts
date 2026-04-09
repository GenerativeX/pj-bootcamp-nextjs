import type { Readable } from "node:stream";

/**
 * ファイル情報
 */
export interface FileInfo {
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
  url: string;
}

/**
 * アップロード用URL情報
 */
export interface UploadUrlInfo {
  signedUrl: string;
  publicUrl: string;
  blobName: string;
}

/**
 * ファイルダウンロード結果
 */
export interface DownloadResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

/**
 * ストリームダウンロード結果
 */
export interface StreamDownloadResult {
  readableStreamBody: Readable | ReadableStream<Uint8Array> | null;
  contentType?: string;
}

/**
 * Blobプロパティ
 */
export interface BlobProperties {
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
}

/**
 * Blob情報
 */
export interface BlobItem {
  name: string;
  properties: BlobProperties;
}

/**
 * ストレージプロバイダーの抽象インターフェース
 */
export interface StorageProvider {
  /**
   * コンテナ/バケットが存在しない場合は作成
   */
  ensureContainerExists(containerName?: string): Promise<void>;

  /**
   * ファイルをアップロード（Buffer）
   */
  uploadData(
    blobName: string,
    data: Buffer,
    options: {
      contentType?: string;
      containerName?: string;
    },
  ): Promise<void>;

  /**
   * ファイルをアップロード（ファイルパス）
   */
  uploadFile(
    blobName: string,
    filePath: string,
    options: {
      contentType?: string;
      containerName?: string;
    },
  ): Promise<void>;

  /**
   * ファイルをアップロード（ストリーム）
   */
  uploadStream(
    blobName: string,
    stream: Readable,
    options: {
      contentType?: string;
      containerName?: string;
    },
  ): Promise<void>;

  /**
   * ファイルをダウンロード（Buffer）
   */
  download(
    blobName: string,
    containerName?: string,
  ): Promise<StreamDownloadResult>;

  /**
   * ファイルをローカルファイルにダウンロード
   */
  downloadToFile(
    blobName: string,
    filePath: string,
    containerName?: string,
  ): Promise<void>;

  /**
   * ファイルが存在するかチェック
   */
  exists(blobName: string, containerName?: string): Promise<boolean>;

  /**
   * ファイルを削除
   */
  deleteBlob(blobName: string, containerName?: string): Promise<void>;

  /**
   * ファイルを削除（存在する場合のみ）
   */
  deleteIfExists(blobName: string, containerName?: string): Promise<boolean>;

  /**
   * ファイルのプロパティを取得
   */
  getProperties(
    blobName: string,
    containerName?: string,
  ): Promise<BlobProperties>;

  /**
   * ファイル一覧を取得
   */
  listBlobs(options: {
    prefix?: string;
    containerName?: string;
  }): AsyncIterable<BlobItem>;

  /**
   * アップロード用の署名付きURLを生成
   */
  generateUploadUrl(
    blobName: string,
    options: {
      containerName?: string;
      expiresInMinutes?: number;
    },
  ): Promise<{ signedUrl: string; publicUrl: string }>;

  /**
   * BlobのURLを取得
   */
  getBlobUrl(blobName: string, containerName?: string): string;
}
