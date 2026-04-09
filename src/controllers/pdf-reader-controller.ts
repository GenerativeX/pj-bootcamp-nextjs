import { PDFParse, VerbosityLevel } from "pdf-parse";
import { join } from "node:path";

export interface PdfPageText {
  index: number;
  text: string;
}

export interface PdfReadResult {
  pages: PdfPageText[];
  totalPages: number;
}

export async function readPdf(fileBuffer: Buffer): Promise<PdfReadResult> {
  // Node.js環境用のWorker設定
  const workerPath = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );

  // Workerを静的に設定
  PDFParse.setWorker(workerPath);

  // 新しいpdf-parseのAPIを使用
  const parser = new PDFParse({
    data: fileBuffer,
    verbosity: VerbosityLevel.ERRORS,
  });

  const result = await parser.getText();
  await parser.destroy();

  // ページごとにテキストを分割
  const pages: PdfPageText[] = result.pages.map((page, index) => ({
    index: index + 1,
    text: page.text.trim(),
  }));

  return {
    pages,
    totalPages: result.pages.length,
  };
}
