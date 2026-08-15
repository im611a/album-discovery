import { execFile } from "node:child_process";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CONTENT_PIPELINE_COVER_PROFILE } from "../cover-profile.mjs";
import { finding, SEVERITY } from "./contracts.mjs";
import { sha256File } from "./utils.mjs";

const run = promisify(execFile);
const codecsByExtension = new Map([[".jpg", "mjpeg"], [".jpeg", "mjpeg"], [".png", "png"], [".webp", "webp"]]);

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function contained(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function inspectImage(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json", file,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
  const stream = JSON.parse(stdout)?.streams?.[0];
  if (!stream || !Number.isInteger(stream.width) || !Number.isInteger(stream.height) || stream.width <= 0 || stream.height <= 0) throw new Error("Image does not contain a decodable video/image stream.");
  return { codec: stream.codec_name, width: stream.width, height: stream.height };
}

async function transcode(source, destination, target) {
  await mkdir(path.dirname(destination), { recursive: true });
  const max = target.maxDimension;
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-map_metadata", "-1",
    "-vf", `scale='min(${max},iw)':'min(${max},ih)':force_original_aspect_ratio=decrease`,
    "-c:v", "libwebp", "-quality", String(target.quality), "-compression_level", "6",
    destination,
  ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
}

export async function validateAndStageCover({ albumId, coverFile, incomingRoot, outputRoot, productionCoverRoot = null }) {
  const findings = [];
  let requested = coverFile;
  if (!requested) {
    const candidates = [`${albumId}.jpg`, `${albumId}.jpeg`, `${albumId}.png`, `${albumId}.webp`];
    const matches = [];
    for (const candidate of candidates) if (await exists(path.resolve(incomingRoot, candidate))) matches.push(candidate);
    if (matches.length > 1) {
      return { findings: [finding(SEVERITY.ERROR, "COVER_SOURCE_COLLISION", `Multiple canonical incoming covers exist for Album ${albumId}: ${matches.join(", ")}.`, "Keep one source or set cover_file explicitly.")], assets: null };
    }
    requested = matches[0] ?? `${albumId}.jpg`;
  }
  if (/^[a-z]+:\/\//i.test(requested)) {
    return { findings: [finding(SEVERITY.ERROR, "REMOTE_COVER_FORBIDDEN", "Incoming cover must be a local file.", "Place the cover in incoming-covers/.")], assets: null };
  }
  const source = path.resolve(incomingRoot, requested);
  if (!contained(incomingRoot, source)) {
    return { findings: [finding(SEVERITY.ERROR, "COVER_PATH_ESCAPE", "cover_file must stay inside incoming-covers/.", "Use a relative local filename.")], assets: null };
  }
  if (!(await exists(source))) {
    return { findings: [finding(SEVERITY.ERROR, "MISSING_COVER", `Incoming cover is missing: ${requested}.`, "Add the local cover file.")], assets: null };
  }
  const sourceStat = await stat(source);
  if (!sourceStat.isFile() || sourceStat.size === 0) {
    return { findings: [finding(SEVERITY.ERROR, "EMPTY_COVER", "Incoming cover must be a non-empty readable file.", "Replace the cover file.")], assets: null };
  }
  let sourceInfo;
  try {
    sourceInfo = await inspectImage(source);
  } catch (error) {
    return { findings: [finding(SEVERITY.ERROR, "CORRUPT_COVER", String(error.message), "Replace the cover with a decodable JPEG, PNG or WebP.")], assets: null };
  }
  const expectedCodec = codecsByExtension.get(path.extname(source).toLocaleLowerCase("en-US"));
  if (!expectedCodec || sourceInfo.codec !== expectedCodec) {
    return { findings: [finding(SEVERITY.ERROR, "COVER_FORMAT_MISMATCH", `Cover extension/codec is not an allowed match (${sourceInfo.codec}).`, "Use a correctly named JPEG, PNG or WebP.")], assets: null };
  }
  if (sourceInfo.width <= 0 || sourceInfo.height <= 0 || sourceInfo.width > 20_000 || sourceInfo.height > 20_000) {
    return { findings: [finding(SEVERITY.ERROR, "INVALID_COVER_DIMENSIONS", `Invalid cover dimensions ${sourceInfo.width}x${sourceInfo.height}.`, "Replace the cover source.")], assets: null };
  }
  const outputs = {};
  for (const [kind, target] of Object.entries({ thumbnail: CONTENT_PIPELINE_COVER_PROFILE.thumbnail, detail: CONTENT_PIPELINE_COVER_PROFILE.detail })) {
    const destination = path.join(outputRoot, target.directory, `${albumId}.webp`);
    try {
      await transcode(source, destination, target);
    } catch (error) {
      findings.push(finding(SEVERITY.ERROR, "COVER_TRANSCODE_FAILED", `Failed to create ${kind} derivative: ${error.message}`, "Inspect ffmpeg and replace the source if needed."));
      continue;
    }
    const info = await inspectImage(destination);
    if (info.codec !== "webp" || Math.max(info.width, info.height) > target.maxDimension || info.width > sourceInfo.width || info.height > sourceInfo.height) {
      findings.push(finding(SEVERITY.ERROR, "COVER_DERIVATIVE_INVALID", `${kind} derivative violates the canonical profile.`, "Inspect ffmpeg and the source image."));
    }
    const outputSha256 = await sha256File(destination);
    if (productionCoverRoot) {
      const productionDestination = path.join(productionCoverRoot, target.directory, `${albumId}.webp`);
      if (await exists(productionDestination) && await sha256File(productionDestination) !== outputSha256) {
        findings.push(finding(SEVERITY.ERROR, "COVER_DESTINATION_COLLISION", `Production destination already contains different bytes: ${target.directory}/${albumId}.webp.`, "Review the Album identity and existing asset."));
      }
    }
    outputs[kind] = { path: destination, relativePath: `${target.directory}/${albumId}.webp`, sha256: outputSha256, bytes: (await stat(destination)).size, ...info };
  }
  return {
    findings,
    assets: outputs.thumbnail && outputs.detail ? {
      profile: CONTENT_PIPELINE_COVER_PROFILE.version,
      source: { path: source, sha256: await sha256File(source), bytes: sourceStat.size, ...sourceInfo },
      ...outputs,
    } : null,
  };
}
