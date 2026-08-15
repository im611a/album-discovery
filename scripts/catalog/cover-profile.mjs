export const CONTENT_PIPELINE_COVER_PROFILE = Object.freeze({
  version: "content-pipeline-cover-v1",
  thumbnail: Object.freeze({ directory: "thumb", maxDimension: 360, quality: 76 }),
  detail: Object.freeze({ directory: "detail", maxDimension: 960, quality: 82 }),
  preserveAspectRatio: true,
  upscale: false,
  format: "webp",
});
