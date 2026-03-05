import { MemoryDay, MemoryItem } from "@/lib/types";
import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { readProjects } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_ROOT =
  process.env.OPENCLAW_MEMORY_ROOT ?? "/home/hank/.openclaw/workspace/main/memory/";
const MAX_FILES = 300;
const MAX_CHARS = 5000;

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".log",
  ".yaml",
  ".yml",
  ".csv",
]);

async function listMemoryFiles(root: string, bucket: string[]): Promise<void> {
  if (bucket.length >= MAX_FILES) {
    return;
  }

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (bucket.length >= MAX_FILES) {
      return;
    }

    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      await listMemoryFiles(fullPath, bucket);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }

    bucket.push(fullPath);
  }
}

function extractDate(pathname: string, fallbackDate: string): string {
  const match = pathname.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? fallbackDate;
}

function compactWhitespace(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function deriveTitle(content: string, fallbackPath: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const compact = compactWhitespace(content);
  if (compact.length > 0) {
    return compact.slice(0, 72);
  }

  return path.basename(fallbackPath);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const projectId = (searchParams.get("projectId") ?? "").trim();
  const discoveredFiles: string[] = [];
  await listMemoryFiles(MEMORY_ROOT, discoveredFiles);

  if (discoveredFiles.length === 0) {
    return NextResponse.json({
      available: false,
      rootPath: MEMORY_ROOT,
      memoryDays: [] as MemoryDay[],
      message: "No memory files were found.",
    });
  }

  const sortedFiles = await Promise.all(
    discoveredFiles.map(async (filePath) => {
      try {
        const stats = await stat(filePath);
        return { filePath, mtimeMs: stats.mtimeMs };
      } catch {
        return { filePath, mtimeMs: 0 };
      }
    }),
  );

  sortedFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const projects = await readProjects();
  const items: MemoryItem[] = [];

  for (const file of sortedFiles) {
    try {
      const raw = await readFile(file.filePath, "utf8");
      const safeContent = raw.slice(0, MAX_CHARS);
      const mtimeDate = new Date(file.mtimeMs || Date.now()).toISOString().slice(0, 10);
      const date = extractDate(file.filePath, mtimeDate);
      const preview = compactWhitespace(safeContent).slice(0, 280);
      const relativePath = path.relative(MEMORY_ROOT, file.filePath);
      const haystack = `${safeContent} ${relativePath}`.toLowerCase();
      const linkedProjectIds = projects
        .filter((project) => haystack.includes(project.name.toLowerCase()))
        .map((project) => project.id);

      items.push({
        id: `${date}-${relativePath}`,
        title: deriveTitle(safeContent, file.filePath),
        date,
        path: relativePath,
        preview,
        content: safeContent,
        linkedProjectIds,
      });
    } catch {
      // Skip unreadable files.
    }
  }

  const byDate = new Map<string, MemoryItem[]>();

  for (const item of items) {
    if (q && !`${item.title} ${item.preview} ${item.path}`.toLowerCase().includes(q)) {
      continue;
    }
    if (projectId && !item.linkedProjectIds?.includes(projectId)) {
      continue;
    }

    const existing = byDate.get(item.date) ?? [];
    existing.push(item);
    byDate.set(item.date, existing);
  }

  const memoryDays: MemoryDay[] = Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayItems]) => ({
      date,
      items: dayItems,
    }));

  return NextResponse.json({
    available: true,
    rootPath: MEMORY_ROOT,
    memoryDays,
    query: q,
    projectId,
  });
}
