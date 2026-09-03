/**
 * A folder in memory with the shape of the File System Access API, as much
 * of it as the workspace uses: enough to read and write a film's files and
 * watch their times change, without a browser.
 */

export class FakeFile {
  readonly kind = "file" as const;
  text = "";
  lastModified = 0;
  constructor(readonly name: string) {}

  async getFile(): Promise<File> {
    return new File([this.text], this.name, { lastModified: this.lastModified });
  }

  async createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> {
    let pending = "";
    return {
      write: async (data: string) => {
        pending += data;
      },
      close: async () => {
        this.text = pending;
        this.lastModified = ++clock;
      },
    };
  }

  async move(destination: FakeDir, name: string): Promise<void> {
    const moved = new FakeFile(name);
    moved.text = this.text;
    moved.lastModified = this.lastModified;
    destination.children.set(name, moved);
  }
}

let clock = 1000;

export class FakeDir {
  readonly kind = "directory" as const;
  readonly children = new Map<string, FakeFile | FakeDir>();
  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDir> {
    const found = this.children.get(name);
    if (found instanceof FakeDir) return found;
    if (found || !options?.create) throw new DOMException("not found", "NotFoundError");
    const made = new FakeDir(name);
    this.children.set(name, made);
    return made;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    const found = this.children.get(name);
    if (found instanceof FakeFile) return found;
    if (found || !options?.create) throw new DOMException("not found", "NotFoundError");
    const made = new FakeFile(name);
    made.lastModified = ++clock;
    this.children.set(name, made);
    return made;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const found = this.children.get(name);
    if (!found) throw new DOMException("not found", "NotFoundError");
    if (found instanceof FakeDir && found.children.size > 0 && !options?.recursive) {
      throw new DOMException("not empty", "InvalidModificationError");
    }
    this.children.delete(name);
  }

  async *entries(): AsyncIterableIterator<[string, FakeFile | FakeDir]> {
    for (const entry of this.children) yield entry;
  }

  async *keys(): AsyncIterableIterator<string> {
    for (const key of this.children.keys()) yield key;
  }

  /** A file's text, for assertions. */
  read(path: string): string | null {
    return readFrom(this, path);
  }

  /** Write a file by path, creating folders, the way an agent's file tools would. */
  async put(path: string, text: string): Promise<void> {
    await putInto(this, path, text);
  }

  list(path = ""): string[] {
    return listFrom(this, path);
  }
}

function readFrom(start: FakeDir, path: string): string | null {
  let node: FakeFile | FakeDir | undefined = start;
  for (const part of path.split("/")) {
    if (!(node instanceof FakeDir)) return null;
    node = node.children.get(part);
  }
  return node instanceof FakeFile ? node.text : null;
}

async function putInto(start: FakeDir, path: string, text: string): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop()!;
  let dir = start;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

function listFrom(start: FakeDir, path: string): string[] {
  let dir = start;
  for (const part of path.split("/").filter(Boolean)) {
    const next = dir.children.get(part);
    if (!(next instanceof FakeDir)) return [];
    dir = next;
  }
  const out: string[] = [];
  const walk = (node: FakeDir, prefix: string) => {
    for (const [name, child] of node.children) {
      const full = prefix ? `${prefix}/${name}` : name;
      if (child instanceof FakeDir) walk(child, full);
      else out.push(full);
    }
  };
  walk(dir, "");
  return out.sort();
}

/** A disk workspace over a fake folder, typed the way the app expects. */
export function fakeWorkspace(): { root: FakeDir; dir: FakeDir; workspace: { kind: "disk"; root: FileSystemDirectoryHandle; dir: FileSystemDirectoryHandle } } {
  const root = new FakeDir("repo");
  const dir = new FakeDir(".prismlaunch");
  root.children.set(".prismlaunch", dir);
  return {
    root,
    dir,
    workspace: {
      kind: "disk",
      root: root as unknown as FileSystemDirectoryHandle,
      dir: dir as unknown as FileSystemDirectoryHandle,
    },
  };
}
