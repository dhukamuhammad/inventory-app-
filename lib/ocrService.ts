import { createWorker, Worker } from "tesseract.js";

let cachedWorker: Worker | null = null;
let initializingPromise: Promise<Worker> | null = null;

export async function getSharedOcrWorker(): Promise<Worker> {
  if (cachedWorker) return cachedWorker;
  if (!initializingPromise) {
    initializingPromise = createWorker("eng")
      .then((w) => {
        cachedWorker = w;
        initializingPromise = null;
        return w;
      })
      .catch((err) => {
        initializingPromise = null;
        throw err;
      });
  }
  return initializingPromise;
}

export async function recognizeImageBuffer(buffer: Buffer): Promise<string> {
  try {
    const worker = await getSharedOcrWorker();
    const ret = await worker.recognize(buffer);
    return ret?.data?.text || "";
  } catch (err) {
    console.error("In-memory OCR error:", err);
    return "";
  }
}
