import { existsSync, statSync } from "node:fs";
import path from "node:path";

function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}

function rscCandidates(requested) {
  const extension = path.extname(requested);
  const basename = path.basename(requested, extension);
  if (extension !== ".txt" || !basename.startsWith("__next.")) return [];
  const segments = basename.split(".");
  const candidates = [];
  for (let split = segments.length - 1; split > 0; split -= 1) {
    candidates.push(path.join(
      path.dirname(requested),
      segments.slice(0, split).join("."),
      `${path.join(...segments.slice(split))}${extension}`,
    ));
  }
  return candidates;
}

export function resolveStaticFile(root, pathname) {
  const requested = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, requested);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return { status: 400, file: null };

  if (existsSync(requested) && statSync(requested).isDirectory()) {
    const index = path.join(requested, "index.html");
    if (isFile(index)) return { status: 200, file: index };
  }
  if (isFile(requested)) return { status: 200, file: requested };
  for (const candidate of rscCandidates(requested)) {
    if (isFile(candidate)) return { status: 200, file: candidate };
  }

  return { status: 404, file: path.join(root, "404.html") };
}
