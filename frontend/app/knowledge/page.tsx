"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSettingsStore, SUPPORTED_MODELS } from "@/stores/settings";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  ArrowLeft,
  Check,
  Clock,
  X,
  AlertCircle,
  Eye,
  FileDigit,
  FileCode2,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import {
  SUPPORTED_FILE_ACCEPT,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_FILE_LABEL,
  getFileTypeCategory,
  getFileTypeLabel,
  getFileTypePreviewCopy,
  getFileTypeTheme,
} from "@/lib/file-types";
import { resolveEmbeddingConfig } from "@/lib/embedding";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader, PageSurface } from "@/components/page-shell";
import { useT } from "@/lib/i18n";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface Document {
  id: string;
  title: string;
  file_type: string;
  status: string;
  created_at: string;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ProcessingProgress {
  percent: number;
  current_page: number;
  total_pages: number;
  message: string;
}

interface DocumentStatus {
  id: string;
  title: string;
  status: string;
  file_type: string;
  progress?: ProcessingProgress;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selfOllamaServiceReady, setSelfOllamaServiceReady] =
    useState<boolean>(false);
  const [selfOllamaModelReady, setSelfOllamaModelReady] =
    useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<
    Record<string, DocumentStatus>
  >({});
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [docInfo, setDocInfo] = useState<{
    total_pages?: number;
    file_size_mb?: number;
  }>({});
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [nextStartPage, setNextStartPage] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pagesPerLoad] = useState<number>(20);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const previewRequestTokenRef = useRef<number>(0);
  const initialPreviewAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const t = useT();
  const locale = useSettingsStore((state) => state.locale);
  const tRef = useRef(t);
  const {
    apiKeys,
    openaiApiKey,
    model,
    baseUrls,
    useLocalEmbedding,
    setUseLocalEmbedding,
  } = useSettingsStore();

  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const provider = SUPPORTED_MODELS.find((m) => m.id === model)?.provider || "openai";
  const isPdfPreview = viewingDoc?.file_type === ".pdf";
  const isMarkdownPreview = viewingDoc?.file_type === ".md";
  const embeddingConfig = resolveEmbeddingConfig({
    apiKeys,
    openaiApiKey,
    baseUrls,
    currentProvider: provider,
    useLocalEmbedding,
  });
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/documents/`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      showToast("error", tRef.current("knowledgeFetchDocumentsFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const refreshDocuments = () => {
      fetchDocuments();
    };

    window.addEventListener("knowledge-documents-updated", refreshDocuments);
    return () =>
      window.removeEventListener("knowledge-documents-updated", refreshDocuments);
  }, [fetchDocuments]);
  useEffect(() => {
    const checkSelfOllama = async () => {
      try {
        const response = await apiFetch("/api/ollama/status");
        if (response.ok) {
          const data = await response.json();
          setSelfOllamaServiceReady(Boolean(data.reachable));
          setSelfOllamaModelReady(Boolean(data.model_available));
        } else {
          setSelfOllamaServiceReady(false);
          setSelfOllamaModelReady(false);
        }
      } catch (error) {
        console.error("Failed to check Self-Ollama status:", error);
        setSelfOllamaServiceReady(false);
        setSelfOllamaModelReady(false);
      }
    };
    checkSelfOllama();
    const interval = setInterval(checkSelfOllama, 10000);
    return () => clearInterval(interval);
  }, []);
  const fetchProcessingStatus = useCallback(async (docId: string) => {
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/documents/${docId}/status`,
      );
      if (response.ok) {
        const data: DocumentStatus = await response.json();
        setProcessingStatus((prev) => ({ ...prev, [docId]: data }));
      }
    } catch (error) {
      console.error("Failed to fetch processing status:", error);
    }
  }, []);
  useEffect(() => {
    const processingDocs = documents.filter((d) => d.status === "processing");
    if (processingDocs.length === 0) {
      setProcessingStatus((prev) =>
        Object.keys(prev).length === 0 ? prev : {},
      );
      return;
    }
    processingDocs.forEach((doc) => fetchProcessingStatus(doc.id));

    const interval = setInterval(() => {
      processingDocs.forEach((doc) => fetchProcessingStatus(doc.id));
      fetchDocuments();
    }, 2000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments, fetchProcessingStatus]);

  const processFile = async (
    file: File,
    options?: {
      currentIndex?: number;
      totalCount?: number;
      showSuccessToast?: boolean;
      manageLoadingState?: boolean;
    },
  ) => {
    if (!embeddingConfig) {
      showToast(
        "error",
        t("knowledgeMissingApiKey", {
          provider: t("settingsModelLabel"),
        }),
      );
      return;
    }
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || !SUPPORTED_FILE_EXTENSIONS.includes(fileExt as (typeof SUPPORTED_FILE_EXTENSIONS)[number])) {
      showToast(
        "error",
        t("knowledgeUnsupportedFileType", {
          types: SUPPORTED_FILE_LABEL,
        }),
      );
      return;
    }

    if (options?.manageLoadingState ?? true) {
      setIsUploading(true);
    }
    const batchPrefix =
      options?.currentIndex && options?.totalCount
        ? ` (${options.currentIndex}/${options.totalCount})`
        : "";
    setUploadProgress(`${t("fileStatusProcessing")}${batchPrefix}`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadProgress(
        options?.currentIndex && options?.totalCount
          ? t("knowledgeUploadBatchProgress", {
            current: options.currentIndex,
            total: options.totalCount,
            name: file.name,
          })
          : t("fileStatusParsing"),
      );
      const params = new URLSearchParams();
      if (!embeddingConfig.useLocalEmbedding) {
        params.append("api_key", embeddingConfig.apiKey);
        params.append("provider", embeddingConfig.provider);
        if (embeddingConfig.baseUrl) {
          params.append("base_url", embeddingConfig.baseUrl);
        }
      }
      params.append(
        "use_local_embedding",
        embeddingConfig.useLocalEmbedding.toString(),
      );

      const response = await apiFetch(
        `${API_BASE_URL}/api/documents/upload?${params.toString()}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        await response.json();
        if (options?.showSuccessToast ?? true) {
          showToast("success", t("fileStatusUploaded", { name: file.name }));
        }
        await fetchDocuments();
        window.dispatchEvent(new Event("knowledge-documents-updated"));
        return true;
      } else {
        let errorMsg = t("knowledgeUploadFailed");
        try {
          const errorData = await response.json();
          errorMsg =
            errorData.detail || errorData.message || JSON.stringify(errorData);
        } catch {
          errorMsg = await response.text();
        }
        showToast("error", `${t("knowledgeUploadFailed")}: ${errorMsg}`);
        return false;
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("error", t("knowledgeUploadDocumentFailed"));
      return false;
    } finally {
      if (options?.manageLoadingState ?? true) {
        setIsUploading(false);
        setUploadProgress("");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const processFiles = async (files: File[]) => {
    const totalCount = files.length;
    if (totalCount === 0) return;

    showToast("info", t("knowledgeUploadBatchStarting", { count: totalCount }));
    setIsUploading(true);

    let successCount = 0;
    let failureCount = 0;
    const perFileErrors: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const ok = await processFile(file, {
        currentIndex: index + 1,
        totalCount,
        showSuccessToast: totalCount === 1,
        manageLoadingState: false,
      });
      if (ok) {
        successCount += 1;
      } else {
        failureCount += 1;
        perFileErrors.push(file.name);
      }
    }

    if (totalCount > 1) {
      const summary =
        failureCount === 0
          ? t("knowledgeUploadBatchComplete", {
            success: successCount,
            total: totalCount,
          })
          : `${t("knowledgeUploadBatchComplete", {
            success: successCount,
            total: totalCount,
          })}，${t("knowledgeUploadBatchPartial", {
            success: successCount,
            failed: failureCount,
          })}`;
      showToast(failureCount === 0 ? "success" : "info", summary);

      if (perFileErrors.length > 0) {
        console.info("Failed uploaded files:", perFileErrors);
      }
    }

    setIsUploading(false);
    setUploadProgress("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    await processFiles(files);
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/documents/${doc.id}/file`,
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.title;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast("success", t("knowledgeDownloadStarted", { name: doc.title }));
      } else {
        showToast("error", t("knowledgeDownloadFailed"));
      }
    } catch (error) {
      console.error("Download error:", error);
      showToast("error", t("knowledgeDownloadFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await apiFetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", t("knowledgeDocumentDeleted"));
        await fetchDocuments();
      } else {
        showToast("error", t("knowledgeDocumentDeleteFailed"));
      }
    } catch (error) {
      console.error("Delete error:", error);
      showToast("error", t("knowledgeDocumentDeleteFailed"));
    }
  };

  const handleViewDocument = async (doc: Document) => {
    previewRequestTokenRef.current += 1;
    const requestToken = previewRequestTokenRef.current;
    initialPreviewAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();

    setViewingDoc(doc);
    setIsLoadingContent(true);
    setIsLoadingMore(false);
    setDocContent("");
    setDocInfo({});
    setCurrentPage(0);
    setNextStartPage(null);
    setPdfPreviewUrl(null);

    const isPDF = doc.file_type === ".pdf";

    if (isPDF) {
      try {
        const controller = new AbortController();
        initialPreviewAbortRef.current = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), 20000);

        let response: Response;
        try {
          response = await apiFetch(
            `${API_BASE_URL}/api/documents/${doc.id}/preview-info`,
            { signal: controller.signal },
          );
        } finally {
          window.clearTimeout(timeoutId);
        }

        if (previewRequestTokenRef.current !== requestToken) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setDocInfo({
            total_pages: data.total_pages,
            file_size_mb: data.file_size_mb,
          });
          setCurrentPage(0);
          setNextStartPage(null);
          try {
            const fileResponse = await apiFetch(
              `${API_BASE_URL}/api/documents/${doc.id}/file`,
            );
            if (fileResponse.ok) {
              const blob = await fileResponse.blob();
              const objectUrl = window.URL.createObjectURL(blob);
              setPdfPreviewUrl((prev) => {
                if (prev) {
                  window.URL.revokeObjectURL(prev);
                }
                return objectUrl;
              });
            } else {
              showToast("error", t("knowledgeLoadPreviewFailed"));
              setViewingDoc(null);
              return;
            }
          } catch (error) {
            console.error("PDF preview file error:", error);
            showToast("error", t("knowledgeLoadPreviewFailed"));
            setViewingDoc(null);
            return;
          }
        } else {
          showToast("error", t("knowledgeLoadPreviewInfoFailed"));
          setViewingDoc(null);
        }
      } catch (error) {
        if (previewRequestTokenRef.current !== requestToken) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("PDF preview info error:", error);
        showToast("error", t("knowledgeLoadPreviewFailed"));
        setViewingDoc(null);
      } finally {
        if (previewRequestTokenRef.current === requestToken) {
          setIsLoadingContent(false);
        }
      }
      return;
    }

    const startPage = 0;
    const endPage = pagesPerLoad;

    try {
      const params = new URLSearchParams();
      params.append("start_page", String(startPage));
      params.append("end_page", String(endPage));

      const controller = new AbortController();
      initialPreviewAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      let response: Response;
      try {
        response = await apiFetch(
          `${API_BASE_URL}/api/documents/${doc.id}/content?${params.toString()}`,
          { signal: controller.signal },
        );
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (previewRequestTokenRef.current !== requestToken) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setDocContent(data.content);
        setDocInfo({
          total_pages: data.total_pages,
          file_size_mb: data.file_size_mb,
        });
        setCurrentPage(data.end_page ?? pagesPerLoad);
        setNextStartPage(
          typeof data.next_start_page === "number"
            ? data.next_start_page
            : null,
        );
      } else {
        showToast("error", t("knowledgeLoadContentFailed"));
        setViewingDoc(null);
      }
    } catch (error) {
      if (previewRequestTokenRef.current !== requestToken) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("View error:", error);
      showToast("error", t("knowledgeLoadContentFailed"));
      setViewingDoc(null);
    } finally {
      if (previewRequestTokenRef.current === requestToken) {
        setIsLoadingContent(false);
      }
    }
  };

  const loadMorePages = useCallback(async () => {
    if (!viewingDoc || !docInfo.total_pages || isLoadingMore) return;
    if (isPdfPreview) return;
    if (currentPage >= docInfo.total_pages) return;

    const requestToken = previewRequestTokenRef.current;
    const startCursor =
      typeof nextStartPage === "number" ? nextStartPage : currentPage;
    const nextPage = startCursor + pagesPerLoad;
    setIsLoadingMore(true);

    try {
      loadMoreAbortRef.current?.abort();
      const controller = new AbortController();
      loadMoreAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      const params = new URLSearchParams();
      params.append("start_page", String(startCursor));
      params.append(
        "end_page",
        String(Math.min(nextPage, docInfo.total_pages)),
      );

      let response: Response;
      try {
        response = await apiFetch(
          `${API_BASE_URL}/api/documents/${viewingDoc.id}/content?${params.toString()}`,
          { signal: controller.signal },
        );
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (previewRequestTokenRef.current !== requestToken) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setDocContent((prev) => prev + data.content);
        setCurrentPage(
          typeof data.end_page === "number"
            ? data.end_page
            : Math.min(nextPage, docInfo.total_pages),
        );
        setNextStartPage(
          typeof data.next_start_page === "number"
            ? data.next_start_page
            : null,
        );
      } else {
        showToast("error", t("knowledgeLoadMoreFailed"));
      }
    } catch (error) {
      if (previewRequestTokenRef.current !== requestToken) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Load more error:", error);
      showToast("error", t("knowledgeLoadMoreFailed"));
    } finally {
      if (previewRequestTokenRef.current === requestToken) {
        setIsLoadingMore(false);
      }
    }
  }, [
    viewingDoc,
    docInfo.total_pages,
    isLoadingMore,
    currentPage,
    nextStartPage,
    pagesPerLoad,
    isPdfPreview,
    showToast,
    t,
  ]);

  useEffect(() => {
    if (!viewingDoc || !docInfo.total_pages) return;
    if (isPdfPreview) return;
    if (currentPage >= docInfo.total_pages) return;
    if (isLoadingContent || isLoadingMore) return;

    const container = contentContainerRef.current;
    if (!container) return;

    if (container.scrollHeight <= container.clientHeight + 8) {
      void loadMorePages();
    }
  }, [
    viewingDoc,
    docInfo.total_pages,
    isPdfPreview,
    currentPage,
    isLoadingContent,
    isLoadingMore,
    docContent,
    loadMorePages,
  ]);

  const closeViewModal = () => {
    previewRequestTokenRef.current += 1;
    initialPreviewAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    setViewingDoc(null);
    setDocContent("");
    setDocInfo({});
    setCurrentPage(0);
    setNextStartPage(null);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setIsLoadingContent(false);
    setIsLoadingMore(false);
  };

  useEffect(() => {
    return () => {
      initialPreviewAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-emerald-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      case "failed":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return t("knowledgeReady");
      case "processing":
        return t("knowledgeProcessing");
      case "failed":
        return t("knowledgeFailed");
      default:
        return status;
    }
  };

  const getDocumentTypeIcon = (fileType: string) => {
    const category = getFileTypeCategory(fileType);
    if (category === "image") {
      return ImageIcon;
    }
    if (category === "table") {
      return FileDigit;
    }
    if (category === "code" || category === "structured") {
      return FileCode2;
    }
    return FileText;
  };

  const getDocumentTypeLabel = (fileType: string) => {
    return getFileTypeLabel(fileType, locale);
  };

  const getDocumentTypeBadgeClassName = (fileType: string) => {
    return getFileTypeTheme(fileType).chipClassName;
  };

  const getDocumentTypeTheme = (fileType: string) => {
    return getFileTypeTheme(fileType);
  };

  const processingDocuments = documents.filter((doc) => doc.status === "processing");

  const isTableLikeFile = (fileType: string) => {
    const normalizedType = fileType.toLowerCase();
    return [".csv", ".tsv", ".xlsx", ".xls"].includes(normalizedType);
  };

  const parseTabularPreview = (content: string) => {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);

    const sections: Array<{ title: string; rows: string[][] }> = [];
    let currentTitle = "";
    let currentRows: string[][] = [];

    const pushSection = () => {
      if (currentTitle || currentRows.length > 0) {
        sections.push({
          title: currentTitle || (locale === "zh" ? "工作表" : "Sheet"),
          rows: currentRows,
        });
      }
      currentTitle = "";
      currentRows = [];
    };

    const splitRow = (line: string) => {
      const trimmed = line.trim();
      if (trimmed.includes("\t")) {
        return trimmed.split("\t").map((cell) => cell.trim());
      }
      if (trimmed.includes(",")) {
        return trimmed.split(",").map((cell) => cell.trim());
      }
      const spaced = trimmed.split(/\s{2,}/).map((cell) => cell.trim());
      if (spaced.length > 1) {
        return spaced;
      }
      return trimmed.split(/\s+/).map((cell) => cell.trim());
    };

    for (const line of lines) {
      const sheetMatch = line.match(/^---\s*Sheet:\s*(.+?)\s*---$/i);
      if (sheetMatch) {
        pushSection();
        currentTitle = sheetMatch[1];
        continue;
      }
      currentRows.push(splitRow(line).filter(Boolean));
    }

    pushSection();
    return sections.length > 0 ? sections : [{ title: locale === "zh" ? "内容" : "Content", rows: lines.map(splitRow) }];
  };

  const renderTabularPreview = (content: string, fileType: string) => {
    const theme = getDocumentTypeTheme(fileType);
    const sections = parseTabularPreview(content);

    return (
      <div className="space-y-4">
        {sections.map((section, sectionIndex) => {
          const maxColumns = Math.max(
            1,
            ...section.rows.map((row) => row.length || 1),
          );

          return (
            <div
              key={`${section.title}-${sectionIndex}`}
              className={`overflow-hidden rounded-2xl border ${theme.panelBg} ${theme.panelBorder}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-inherit px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`text-sm font-semibold ${theme.iconText}`}>
                    {section.title}
                  </span>
                  <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {section.rows.length} {locale === "zh" ? "行" : "rows"}
                  </span>
                </div>
                <span className={`text-xs ${theme.iconText} opacity-80`}>
                  {maxColumns} {locale === "zh" ? "列" : "cols"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {section.rows.map((row, rowIndex) => (
                    <div
                      key={`${section.title}-${sectionIndex}-row-${rowIndex}`}
                      className={`grid border-b border-border/60 last:border-b-0 ${rowIndex === 0
                        ? "bg-background/80 font-semibold"
                        : rowIndex % 2 === 0
                          ? "bg-background/55"
                          : "bg-background/35"
                        }`}
                      style={{
                        gridTemplateColumns: `repeat(${maxColumns}, minmax(140px, 1fr))`,
                      }}
                    >
                      {Array.from({ length: maxColumns }).map((_, cellIndex) => (
                        <div
                          key={`${section.title}-${sectionIndex}-row-${rowIndex}-cell-${cellIndex}`}
                          className={`min-w-0 border-r border-border/60 px-4 py-3 text-sm last:border-r-0 ${rowIndex === 0 ? "text-foreground" : "text-muted-foreground"
                            }`}
                        >
                          <span className="block truncate">
                            {row[cellIndex] ?? ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right fade-in duration-200 ${toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : toast.type === "error"
                ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                : "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
              }`}
          >
            {toast.type === "success" && <Check className="h-4 w-4" />}
            {toast.type === "error" && <AlertCircle className="h-4 w-4" />}
            {toast.type === "info" && <Clock className="h-4 w-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
      <aside className="hidden">
        <div className="p-4">
          <Link
            href="/chat"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("knowledgeBackToChat")}
          </Link>
        </div>

        <nav className="flex-1 px-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {t("knowledgeHome")}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {t("knowledgeSettings")}
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <PageContainer>
          <PageHeader
            title={t("knowledgeTitle")}
            description={t("knowledgeSubtitle")}
            actions={
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={SUPPORTED_FILE_ACCEPT}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="rounded-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("knowledgeUploadLoading")}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("knowledgeUploadDocument")}
                    </>
                  )}
                </Button>
              </>
            }
          />
          <PageSurface className="mb-4 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${selfOllamaServiceReady
                  ? selfOllamaModelReady
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                  : "bg-muted-foreground/50"
                  }`}
              />
              <div>
                <p className="text-sm font-medium">
                  {t("knowledgeUseLocalEmbedding")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {!selfOllamaServiceReady
                    ? t("knowledgeLocalEmbeddingMissing")
                    : selfOllamaModelReady
                      ? t("knowledgeLocalEmbeddingDetected")
                      : t("knowledgeSelfOllamaModelWillBePulled")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setUseLocalEmbedding(!useLocalEmbedding)}
              disabled={!selfOllamaServiceReady}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useLocalEmbedding && selfOllamaServiceReady
                ? "bg-emerald-500"
                : "bg-muted"
                } ${!selfOllamaServiceReady ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${useLocalEmbedding ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </PageSurface>

          {processingDocuments.length > 0 && (
            <PageSurface className="mb-4 border-blue-200/80 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    {t("knowledgeProcessing")}
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                    {t("knowledgePleaseDoNotClosePage")}
                  </p>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-300">
                  {locale === "zh"
                    ? `处理中：${processingDocuments.length}`
                    : `Processing: ${processingDocuments.length}`}
                </div>
              </div>
              <div className="space-y-3">
                {processingDocuments.map((doc) => {
                  const progress = processingStatus[doc.id]?.progress;
                  const message = processingStatus[doc.id]?.progress?.message;
                  const theme = getDocumentTypeTheme(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className={`rounded-2xl border px-4 py-3 shadow-sm ${theme.panelBg} ${theme.panelBorder}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`truncate font-semibold ${theme.iconText}`}>
                              {doc.title}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] ${getDocumentTypeBadgeClassName(doc.file_type)}`}
                            >
                              {getDocumentTypeLabel(doc.file_type)}
                            </span>
                          </div>
                          <p className={`mt-1 text-xs ${theme.iconText} opacity-80`}>
                            {message || t("knowledgeLoadingDocumentContent")}
                          </p>
                        </div>
                        <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.iconText} ${theme.panelBg}`}>
                          {progress?.percent ?? 0}%
                        </div>
                      </div>
                      <div className={`mt-3 h-2 overflow-hidden rounded-full bg-background/60`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${theme.progressBar}`}
                          style={{ width: `${progress?.percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </PageSurface>
          )}
          <PageSurface
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`mb-4 cursor-pointer border-2 border-dashed text-center transition-all ${isDragging
              ? "border-primary bg-primary/5"
              : "border-border/70 hover:border-muted-foreground/40"
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            {isUploading ? (
              <>
                <p className="font-medium text-foreground">{uploadProgress}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("knowledgePleaseDoNotClosePage")}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  {t("knowledgeDragDropHint")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("knowledgeSupportedFormats")}
                </p>
              </>
            )}
          </PageSurface>
          <div className="border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">{t("knowledgeLoading")}</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">{t("knowledgeNoDocuments")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("knowledgeNoDocumentsHint")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => {
                  const canPreview = doc.status !== "failed";
                  const DocumentIcon = getDocumentTypeIcon(doc.file_type);
                  const theme = getDocumentTypeTheme(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-4 transition-colors ${theme.rowClassName}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${theme.iconBg}`}
                        >
                          <DocumentIcon className={`h-5 w-5 ${theme.iconText}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${getDocumentTypeBadgeClassName(doc.file_type)}`}
                            >
                              {getDocumentTypeLabel(doc.file_type)}
                            </span>
                            <span>•</span>
                            <span>{doc.file_type.toUpperCase()}</span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(doc.status)}
                              {getStatusText(doc.status)}
                            </span>
                          </div>
                          {doc.status === "processing" &&
                            processingStatus[doc.id]?.progress && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                      style={{
                                        width: `${processingStatus[doc.id].progress!.percent}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                    {processingStatus[doc.id].progress!.percent}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {processingStatus[doc.id].progress!.message}
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(doc);
                          }}
                          className="p-2 hover:bg-emerald-500/10 hover:text-emerald-600 rounded-lg transition-colors"
                          title={t("knowledgeDownloadOriginal")}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canPreview) return;
                            handleViewDocument(doc);
                          }}
                          disabled={!canPreview}
                          className={`p-2 rounded-lg transition-colors ${theme.actionButtonClassName} ${canPreview ? "" : "opacity-40 cursor-not-allowed"
                            }`}
                          title={
                            canPreview
                              ? t("knowledgeViewParsed")
                              : t("knowledgePreviewUnavailable")
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(doc.id);
                          }}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                          title={t("knowledgeDelete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PageContainer>
      </main>
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && closeViewModal()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0">
          {viewingDoc && (
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
              <DialogTitle className="sr-only">
                {t("knowledgePreviewTitle", { name: viewingDoc.title })}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("knowledgePreviewDescription")}
              </DialogDescription>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {(() => {
                    const DocumentIcon = getDocumentTypeIcon(viewingDoc.file_type);
                    const theme = getDocumentTypeTheme(viewingDoc.file_type);
                    return (
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${theme.iconBg}`}>
                        <DocumentIcon className={`h-5 w-5 ${theme.iconText}`} />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="font-semibold">{viewingDoc.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      <span
                        className={`mr-1 inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getDocumentTypeBadgeClassName(viewingDoc.file_type)}`}
                      >
                        {getDocumentTypeLabel(viewingDoc.file_type)}
                      </span>
                      •{" "}
                      {viewingDoc.file_type.toUpperCase()} •{" "}
                      {new Date(viewingDoc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              {(() => {
                const previewCopy = getFileTypePreviewCopy(viewingDoc.file_type, locale);
                const theme = getDocumentTypeTheme(viewingDoc.file_type);
                const DocumentIcon = getDocumentTypeIcon(viewingDoc.file_type);
                return (
                  <div className={`mx-6 mt-4 rounded-2xl border px-4 py-4 ${theme.panelBg} ${theme.panelBorder}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
                        <DocumentIcon className={`h-6 w-6 ${theme.iconText}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${getDocumentTypeBadgeClassName(viewingDoc.file_type)}`}
                          >
                            {getDocumentTypeLabel(viewingDoc.file_type)}
                          </span>
                          <span className={`text-sm font-semibold ${theme.iconText}`}>
                            {previewCopy.title}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                          {previewCopy.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {docInfo.total_pages && (
                <div className="mx-6 mt-4 flex items-center gap-4 rounded-xl border border-border/70 bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileDigit className="h-3.5 w-3.5" />
                    {t("knowledgeTotalPages", { count: docInfo.total_pages })}
                  </span>
                  {docInfo.file_size_mb && <span>•</span>}
                  {!isPdfPreview && <span>•</span>}
                  {!isPdfPreview && currentPage < docInfo.total_pages && (
                    <span className="text-amber-500">
                      ({t("knowledgeScrollForMore")})
                    </span>
                  )}
                </div>
              )}
              <div
                ref={contentContainerRef}
                className="flex-1 overflow-y-auto p-6"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  const nearBottom =
                    target.scrollHeight - target.scrollTop - target.clientHeight <
                    100;
                  if (
                    nearBottom &&
                    docInfo.total_pages &&
                    !isPdfPreview &&
                    currentPage < docInfo.total_pages &&
                    !isLoadingContent &&
                    !isLoadingMore
                  ) {
                    void loadMorePages();
                  }
                }}
              >
                {isLoadingContent ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 py-14 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      {t("knowledgeLoadingDocumentContent")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("knowledgePleaseDoNotClosePage")}
                    </p>
                  </div>
                ) : isPdfPreview ? (
                  <div className={`h-full min-h-[480px] overflow-hidden rounded-2xl border ${getDocumentTypeTheme(viewingDoc.file_type).panelBorder} ${getDocumentTypeTheme(viewingDoc.file_type).panelBg}`}>
                    {pdfPreviewUrl ? (
                      <iframe
                        src={pdfPreviewUrl}
                        title={viewingDoc.title}
                        className="w-full h-full min-h-[480px]"
                      />
                    ) : (
                      <div className="flex h-full min-h-[480px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ) : isMarkdownPreview ? (
                  <div className={`max-w-none rounded-2xl border px-5 py-5 ${getDocumentTypeTheme(viewingDoc.file_type).panelBg} ${getDocumentTypeTheme(viewingDoc.file_type).panelBorder}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isInline = !className?.includes("language-");
                          return isInline ? (
                            <code
                              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <pre className="my-4 overflow-x-auto rounded-xl bg-muted p-4">
                              <code className="font-mono text-sm leading-6" {...props}>
                                {children}
                              </code>
                            </pre>
                          );
                        },
                        h1: ({ children }) => <h1 className="mt-6 mb-3 text-3xl font-semibold tracking-tight">{children}</h1>,
                        h2: ({ children }) => <h2 className="mt-6 mb-3 text-2xl font-semibold tracking-tight">{children}</h2>,
                        h3: ({ children }) => <h3 className="mt-5 mb-2 text-xl font-semibold tracking-tight">{children}</h3>,
                        p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
                        ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-7">{children}</li>,
                        table: ({ children }) => (
                          <div className="my-4 overflow-x-auto">
                            <table className="w-full border-collapse border border-border">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-border px-3 py-2 align-top">{children}</td>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="my-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {docContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="max-w-none">
                    {docContent.trim() ? (
                      <>
                        {isTableLikeFile(viewingDoc.file_type) ? (
                          renderTabularPreview(docContent, viewingDoc.file_type)
                        ) : (
                          <div className={`overflow-hidden rounded-2xl border ${getDocumentTypeTheme(viewingDoc.file_type).panelBg} ${getDocumentTypeTheme(viewingDoc.file_type).panelBorder}`}>
                            <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${getDocumentTypeTheme(viewingDoc.file_type).iconText}`}>
                                  {getFileTypePreviewCopy(viewingDoc.file_type, locale).title}
                                </span>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] ${getDocumentTypeBadgeClassName(viewingDoc.file_type)}`}>
                                  {getDocumentTypeLabel(viewingDoc.file_type)}
                                </span>
                              </div>
                            </div>
                            <pre className={`whitespace-pre-wrap text-sm leading-relaxed px-4 py-4 overflow-x-auto ${[".py", ".js", ".ts", ".java", ".go", ".json", ".xml", ".yaml", ".yml", ".log", ".srt", ".vtt"].includes(viewingDoc.file_type.toLowerCase()) ? "font-mono tabular-nums" : "font-sans"}`}>
                              {docContent}
                            </pre>
                          </div>
                        )}
                        {docInfo.total_pages && currentPage < docInfo.total_pages && (
                          <div className="flex flex-col items-center justify-center py-6 gap-2">
                            {isLoadingMore ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {t("knowledgeLoadingMoreContent")}
                                </span>
                              </>
                            ) : (
                              <button
                                onClick={() => void loadMorePages()}
                                className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
                              >
                                {t("knowledgeLoadNextBatch")}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center ${getDocumentTypeTheme(viewingDoc.file_type).panelBg} ${getDocumentTypeTheme(viewingDoc.file_type).panelBorder}`}>
                        <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background ${getDocumentTypeTheme(viewingDoc.file_type).iconText}`}>
                          {(() => {
                            const DocumentIcon = getDocumentTypeIcon(viewingDoc.file_type);
                            return <DocumentIcon className="h-6 w-6" />;
                          })()}
                        </div>
                        <h3 className="text-sm font-medium text-foreground">
                          {getFileTypePreviewCopy(viewingDoc.file_type, locale).emptyTitle}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getFileTypePreviewCopy(viewingDoc.file_type, locale).emptyHint}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30">
                {docInfo.total_pages &&
                  docInfo.total_pages > 1 &&
                  !isPdfPreview && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("knowledgeLoadedPages", {
                          current: Math.min(currentPage, docInfo.total_pages),
                          total: docInfo.total_pages,
                        })}
                      </span>
                    </div>
                  )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={closeViewModal}
                    className="px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors text-sm font-medium"
                  >
                    {t("knowledgeClose")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("knowledgeDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("knowledgeDeleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("chatCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) {
                  handleDelete(pendingDeleteId);
                }
                setPendingDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("knowledgeDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}






