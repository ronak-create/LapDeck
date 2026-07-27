// Filesystem: browse directories and open files/folders in the file manager.
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { open } from "../os/launcher.js";
import { IS_WIN } from "../platform.js";

// Reserved DOS device names that must never be resolved as paths (Windows only;
// they're ordinary filenames on Linux).
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function safeResolve(p) {
  const resolved = path.resolve(p || os.homedir());
  const base = path.basename(resolved);
  if (IS_WIN && RESERVED.test(base)) throw new Error("invalid path");
  return resolved;
}

export const fsHandlers = {
  "fs.list": async ({ path: p } = {}) => {
    const dir = safeResolve(p || os.homedir());
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const items = [];
    for (const e of entries) {
      let size = 0;
      const full = path.join(dir, e.name);
      if (!e.isDirectory()) {
        try {
          size = (await fsp.stat(full)).size;
        } catch {
          // unreadable file: leave size 0
        }
      }
      items.push({ name: e.name, path: full, isDir: e.isDirectory(), size });
    }
    items.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return { path: dir, parent: path.dirname(dir), items };
  },

  "fs.open": async ({ path: p }) => {
    const target = safeResolve(p);
    // Opens folders and files via the OS default handler, foregrounded.
    open(target);
    return { opened: target };
  },
};
