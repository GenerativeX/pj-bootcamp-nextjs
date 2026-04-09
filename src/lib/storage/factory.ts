import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";

let storageProviderInstance: StorageProvider | null = null;

/**
 * ストレージプロバイダーのファクトリー関数
 * 環境変数 STORAGE_PROVIDER で local を指定（デフォルト: local）
 */
export function getStorageProvider(): StorageProvider {
  if (!storageProviderInstance) {
    const provider = process.env.STORAGE_PROVIDER || "local";

    switch (provider.toLowerCase()) {
      case "local":
        storageProviderInstance = new LocalStorageProvider();
        break;
      default:
        throw new Error(`Unknown storage provider: ${provider}. Use 'local'.`);
    }
  }

  return storageProviderInstance;
}

/**
 * ストレージプロバイダーインスタンスをリセット（テスト用）
 */
export function resetStorageProvider(): void {
  storageProviderInstance = null;
}
