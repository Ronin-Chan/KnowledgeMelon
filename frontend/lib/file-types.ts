export const SUPPORTED_FILE_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "csv",
  "tsv",
  "txt",
  "md",
  "html",
  "htm",
  "rtf",
  "json",
  "xml",
  "yaml",
  "yml",
  "log",
  "srt",
  "vtt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "py",
  "js",
  "ts",
  "java",
  "go",
] as const;

export const SUPPORTED_FILE_ACCEPT = SUPPORTED_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(",");

export const SUPPORTED_FILE_LABEL = SUPPORTED_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(", ");

