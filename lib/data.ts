import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

export function getDataDir(): string {
  return DATA_DIR;
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  await mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, fileName);

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(fileName, fallback);
    return fallback;
  }
}

export async function writeJsonFile<T>(fileName: string, value: T): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, fileName);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
