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
        iconBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
        iconText: "text-fuchsia-600 dark:text-fuchsia-300",
        panelBg: "bg-background",
        panelBorder: "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName:
          "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-200",
        rowClassName:
          "bg-background hover:bg-muted/40",
        actionButtonClassName:
          "hover:bg-fuchsia-500/10 hover:text-fuchsia-600 dark:hover:bg-fuchsia-400/10 dark:hover:text-fuchsia-300",
        progressBar: "bg-fuchsia-500",
      };
    case "table":
      return {
        iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
        iconText: "text-emerald-600 dark:text-emerald-300",
        panelBg: "bg-background",
        panelBorder: "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200",
        rowClassName:
          "bg-background hover:bg-muted/40",
        actionButtonClassName:
          "hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300",
        progressBar: "bg-emerald-500",
      };
    case "code":
      return {
        iconBg: "bg-indigo-50 dark:bg-indigo-950/40",
        iconText: "text-indigo-600 dark:text-indigo-300",
        panelBg: "bg-background",
        panelBorder: "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200",
        rowClassName:
          "bg-background hover:bg-muted/40",
        actionButtonClassName:
          "hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-300",
        progressBar: "bg-indigo-500",
      };
    case "structured":
      return {
        iconBg: "bg-amber-50 dark:bg-amber-950/40",
        iconText: "text-amber-600 dark:text-amber-300",
        panelBg: "bg-background",
        panelBorder: "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName:
          "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200",
        rowClassName:
          "bg-background hover:bg-muted/40",
        actionButtonClassName:
          "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:bg-amber-400/10 dark:hover:text-amber-300",
        progressBar: "bg-amber-500",
      };
    case "document":
      return {
        iconBg: "bg-sky-50 dark:bg-sky-950/40",
        iconText: "text-sky-600 dark:text-sky-300",
        panelBg: "bg-background",
        panelBorder: "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName:
          "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200",
        rowClassName:
          "bg-background hover:bg-muted/40",
        actionButtonClassName:
          "hover:bg-sky-500/10 hover:text-sky-600 dark:hover:bg-sky-400/10 dark:hover:text-sky-300",
        progressBar: "bg-sky-500",
      };
    default:
      return {
        iconBg: "bg-muted",
        iconText: "text-muted-foreground",
        panelBg: "bg-background",
        panelBorder:
          "shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
        chipClassName: "bg-muted text-muted-foreground",
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
            description:
              "已从截图或图片中提取文字，适合查看扫描件、截图和带注释图片。",
            emptyTitle: "未识别到图片文字",
            emptyHint: "这类文件可能只有图像内容，没有可提取的文字。",
          }
        : {
            title: "Image OCR preview",
            description:
              "Text extracted from screenshots or photos, useful for scans, annotations, and image notes.",
            emptyTitle: "No text detected in image",
            emptyHint: "This file may contain only visual content without extractable text.",
          };
    case "table":
      return locale === "zh"
        ? {
            title: "表格内容预览",
            description:
              "适合查看按行列组织的数据，如 CSV、TSV 或电子表格导出内容。",
            emptyTitle: "未生成表格预览",
            emptyHint: "当前文件没有可显示的表格文本。",
          }
        : {
            title: "Spreadsheet preview",
            description:
              "Best for row-and-column data such as CSV, TSV, and spreadsheet exports.",
            emptyTitle: "No table preview available",
            emptyHint: "This file does not contain table text that can be shown here.",
          };
    case "code":
      return locale === "zh"
        ? {
            title: "代码与配置预览",
            description:
              "适合查看源代码、脚本和配置文件，保留更多文本结构感。",
            emptyTitle: "未生成代码预览",
            emptyHint: "当前文件没有可显示的代码内容。",
          }
        : {
            title: "Code and config preview",
            description:
              "Useful for source files, scripts, and config content with a stronger code-like feel.",
            emptyTitle: "No code preview available",
            emptyHint: "This file does not contain displayable code content.",
          };
    case "structured":
      return locale === "zh"
        ? {
            title: "结构化文本预览",
            description:
              "适合 JSON、XML、日志、字幕等结构化或半结构化文本。",
            emptyTitle: "未生成结构化预览",
            emptyHint: "当前文件没有可显示的结构化文本。",
          }
        : {
            title: "Structured text preview",
            description:
              "Useful for JSON, XML, logs, subtitles, and other semi-structured text.",
            emptyTitle: "No structured preview available",
            emptyHint: "This file does not contain displayable structured text.",
          };
    case "document":
      return locale === "zh"
        ? {
            title: "文档内容预览",
            description:
              "适合 PDF、Word、PPT、Markdown 和纯文本等常见文档。",
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
