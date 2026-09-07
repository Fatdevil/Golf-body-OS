import { PipelineTrace } from '../types/pipeline-trace';

export const VERSION = 'TRACE_STORAGE_V1';

export interface FileSystemAdapter {
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string | null>;
  listFiles(directory: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  joinPath(...segments: string[]): string;
}

export class TraceStorage {
  private baseDir: string;
  private fs: FileSystemAdapter;

  constructor(baseDir: string, fsAdapter: FileSystemAdapter) {
    this.baseDir = baseDir;
    this.fs = fsAdapter;
  }

  async save(trace: PipelineTrace): Promise<string> {
    const filePath = this.fs.joinPath(this.baseDir, `${trace.sessionId}.json`);
    await this.fs.writeFile(filePath, JSON.stringify(trace, null, 2));
    return filePath;
  }

  async load(sessionId: string): Promise<PipelineTrace | null> {
    const filePath = this.fs.joinPath(this.baseDir, `${sessionId}.json`);
    const exists = await this.fs.exists(filePath);
    if (!exists) {
      return null;
    }
    const data = await this.fs.readFile(filePath);
    if (!data) return null;
    return JSON.parse(data) as PipelineTrace;
  }

  async list(): Promise<string[]> {
    const files = await this.fs.listFiles(this.baseDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }
}
