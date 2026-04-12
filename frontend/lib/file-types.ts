import type { Locale } from "@/lib/i18n";

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

const IMAGE_FILE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
const TABLE_FILE_EXTENSIONS = ["csv", "tsv", "xlsx", "xls"] as const;
const CODE_FILE_EXTENSIONS = ["py", "js", "ts", "java", "go"] as const;
const STRUCTURED_FILE_EXTENSIONS = [
  "json",
  "xml",
  "yaml",
  "yml",
  "log",
  "srt",
  "vtt",
] as const;
const DOCUMENT_FILE_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "txt",
  "md",
  "html",
  "htm",
  "rtf",
] as const;

export type FileTypeCategory =
  | "image"
  | "table"
  | "code"
  | "structured"
  | "document"
  | "other";

export interface FileTypeTheme {
  iconBg: string;
  iconText: string;
  panelBg: string;
  panelBorder: string;
  chipClassName: string;
  rowClassName: string;
  actionButtonClassName: string;
  progressBar: string;
}

export interface FileTypePreviewCopy {
  title: string;
  description: string;
  emptyTitle: string;
  emptyHint: string;
}

const isOneOf = (fileType: string, extensions: readonly string[]) =>
  extensions.includes(fileType.toLowerCase());

export const getFileTypeCategory = (fileType: string): FileTypeCategory => {
  const normalizedType = fileType.toLowerCase();
  if (isOneOf(normalizedType, IMAGE_FILE_EXTENSIONS)) {
    return "image";
  }
  if (isOneOf(normalizedType, TABLE_FILE_EXTENSIONS)) {
    return "table";
  }
  if (isOneOf(normalizedType, CODE_FILE_EXTENSIONS)) {
    return "code";
  }
  if (isOneOf(normalizedType, STRUCTURED_FILE_EXTENSIONS)) {
    return "structured";
  }
  if (isOneOf(normalizedType, DOCUMENT_FILE_EXTENSIONS)) {
    return "document";
  }
  return "other";
};

export const getFileTypeLabel = (fileType: string, locale: Locale) => {
  switch (getFileTypeCategory(fileType)) {
    case "image":
      return locale === "zh" ? "截图" : "Image";
    case "table":
      return locale === "zh" ? "表格" : "Spreadsheet";
    case "code":
      return locale === "zh" ? "代码" : "Code";
    case "structured":
      return locale === "zh" ? "结构化/日志" : "Structured";
    case "document":
      return locale === "zh" ? "文档" : "Document";
    default:
      return fileType.replace(".", "").toUpperCase();
  }
};

export const getFileTypeTheme = (fileType: string): FileTypeTheme => {
  switch (getFileTypeCategory(fileType)) {
    case "image":
      return {
        iconBg: "bg-fuchsia-100 dark:bg-fuchsia-950/50",
        iconText: "text-fuchsia-700 dark:text-fuchsia-300",
        panelBg: "bg-fuchsia-50/70 dark:bg-fuchsia-950/20",
        panelBorder: "border-fuchsia-200 dark:border-fuchsia-900/60",
        chipClassName:
          "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-200",
        rowClassName:
          "bg-fuchsia-50/50 hover:bg-fuchsia-100/70 dark:bg-fuchsia-950/10 dark:hover:bg-fuchsia-950/20",
        actionButtonClassName:
          "hover:bg-fuchsia-500/10 hover:text-fuchsia-600 dark:hover:bg-fuchsia-400/10 dark:hover:text-fuchsia-300",
        progressBar: "bg-fuchsia-500",
      };
    case "table":
      return {
        iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
        iconText: "text-emerald-700 dark:text-emerald-300",
        panelBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
        panelBorder: "border-emerald-200 dark:border-emerald-900/60",
        chipClassName:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
        rowClassName:
          "bg-emerald-50/50 hover:bg-emerald-100/70 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20",
        actionButtonClassName:
          "hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300",
        progressBar: "bg-emerald-500",
      };
    case "code":
      return {
        iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
        iconText: "text-indigo-700 dark:text-indigo-300",
        panelBg: "bg-indigo-50/70 dark:bg-indigo-950/20",
        panelBorder: "border-indigo-200 dark:border-indigo-900/60",
        chipClassName:
          "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200",
        rowClassName:
          "bg-indigo-50/50 hover:bg-indigo-100/70 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20",
        actionButtonClassName:
          "hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-300",
        progressBar: "bg-indigo-500",
      };
    case "structured":
      return {
        iconBg: "bg-amber-100 dark:bg-amber-950/50",
        iconText: "text-amber-700 dark:text-amber-300",
        panelBg: "bg-amber-50/70 dark:bg-amber-950/20",
        panelBorder: "border-amber-200 dark:border-amber-900/60",
        chipClassName:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
        rowClassName:
          "bg-amber-50/50 hover:bg-amber-100/70 dark:bg-amber-950/10 dark:hover:bg-amber-950/20",
        actionButtonClassName:
          "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:bg-amber-400/10 dark:hover:text-amber-300",
        progressBar: "bg-amber-500",
      };
    case "document":
      return {
        iconBg: "bg-sky-100 dark:bg-sky-950/50",
        iconText: "text-sky-700 dark:text-sky-300",
        panelBg: "bg-sky-50/70 dark:bg-sky-950/20",
        panelBorder: "border-sky-200 dark:border-sky-900/60",
        chipClassName:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200",
        rowClassName:
          "bg-sky-50/50 hover:bg-sky-100/70 dark:bg-sky-950/10 dark:hover:bg-sky-950/20",
        actionButtonClassName:
          "hover:bg-sky-500/10 hover:text-sky-600 dark:hover:bg-sky-400/10 dark:hover:text-sky-300",
        progressBar: "bg-sky-500",
      };
    default:
      return {
        iconBg: "bg-muted",
        iconText: "text-muted-foreground",
        panelBg: "bg-white/70 dark:bg-muted/20",
        panelBorder: "border-border",
        chipClassName: "border-border bg-muted/50 text-muted-foreground",
        rowClassName: "bg-background hover:bg-muted/60",
        actionButtonClassName: "hover:bg-muted hover:text-foreground",
        progressBar: "bg-blue-500",
      };
  }
};

export const getFileTypePreviewCopy = (
  fileType: string,
  locale: Locale,
): FileTypePreviewCopy => {
  switch (getFileTypeCategory(fileType)) {
    case "image":
      return locale === "zh"
        ? {
            title: "图片 OCR 预览",
            description: "已从截图或图片中提取文字，适合查看扫描件、截图和带注释图片。",
            emptyTitle: "未识别到图片文字",
            emptyHint: "这类文件可能只有图像内容，没有可提取的文字。",
          }
        : {
            title: "Image OCR preview",
            description: "Text extracted from screenshots or photos, useful for scans, annotations, and image notes.",
            emptyTitle: "No text detected in image",
            emptyHint: "This file may contain only visual content without extractable text.",
          };
    case "table":
      return locale === "zh"
        ? {
            title: "表格内容预览",
            description: "适合查看按行列组织的数据，如 CSV、TSV 或电子表格导出内容。",
            emptyTitle: "未生成表格预览",
            emptyHint: "当前文件没有可显示的表格文本。",
          }
        : {
            title: "Spreadsheet preview",
            description: "Best for row-and-column data such as CSV, TSV, and spreadsheet exports.",
            emptyTitle: "No table preview available",
            emptyHint: "This file does not contain table text that can be shown here.",
          };
    case "code":
      return locale === "zh"
        ? {
            title: "代码与配置预览",
            description: "适合查看源代码、脚本和配置文件，保留更多文本结构感。",
            emptyTitle: "未生成代码预览",
            emptyHint: "当前文件没有可显示的代码内容。",
          }
        : {
            title: "Code and config preview",
            description: "Useful for source files, scripts, and config content with a stronger code-like feel.",
            emptyTitle: "No code preview available",
            emptyHint: "This file does not contain displayable code content.",
          };
    case "structured":
      return locale === "zh"
        ? {
            title: "结构化文本预览",
            description: "适合 JSON、XML、日志、字幕等结构化或半结构化文本。",
            emptyTitle: "未生成结构化预览",
            emptyHint: "当前文件没有可显示的结构化文本。",
          }
        : {
            title: "Structured text preview",
            description: "Useful for JSON, XML, logs, subtitles, and other semi-structured text.",
            emptyTitle: "No structured preview available",
            emptyHint: "This file does not contain displayable structured text.",
          };
    case "document":
      return locale === "zh"
        ? {
            title: "文档内容预览",
            description: "适合 PDF、Word、PPT、Markdown 和纯文本等常见文档。",
            emptyTitle: "未生成文档预览",
            emptyHint: "当前文件没有可显示的文档文字。",
          }
        : {
            title: "Document preview",
            description: "Best for PDFs, Word docs, slides, Markdown, and plain text.",
            emptyTitle: "No document preview available",
            emptyHint: "This file does not contain displayable document text.",
          };
    default:
      return locale === "zh"
        ? {
            title: "文件预览",
            description: "已提取可检索文本。",
            emptyTitle: "没有可预览的内容",
            emptyHint: "当前文件没有可提取的文字。",
          }
        : {
            title: "File preview",
            description: "Extracted text is ready for browsing and search.",
            emptyTitle: "Nothing to preview",
            emptyHint: "This file does not contain extractable text.",
          };
  }
};
