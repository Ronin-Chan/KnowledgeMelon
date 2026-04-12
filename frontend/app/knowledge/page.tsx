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
} from "@/lib/file-types";
import { resolveEmbeddingConfig } from "@/lib/embedding";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
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

  const processFile = async (file: File) => {
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

    setIsUploading(true);
    setUploadProgress(t("knowledgeUploadLoading"));

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadProgress(t("knowledgeLoadingDocumentContent"));
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
        showToast("success", t("knowledgeUploadSuccess", { name: file.name }));
        await fetchDocuments();
        window.dispatchEvent(new Event("knowledge-documents-updated"));
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
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("error", t("knowledgeUploadDocumentFailed"));
    } finally {
      setIsUploading(false);
      setUploadProgress("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    for (const file of files) {
      await processFile(file);
    }
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

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
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
    setIsLoadingContent(false);
    setIsLoadingMore(false);
  };

  useEffect(() => {
    return () => {
      initialPreviewAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, []);

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
    const normalizedType = fileType.toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(normalizedType)) {
      return ImageIcon;
    }
    if ([".csv", ".tsv", ".xlsx", ".xls"].includes(normalizedType)) {
      return FileDigit;
    }
    if ([".py", ".js", ".ts", ".java", ".go", ".json", ".xml", ".yaml", ".yml", ".log", ".srt", ".vtt"].includes(normalizedType)) {
      return FileCode2;
    }
    return FileText;
  };

  const getDocumentTypeLabel = (fileType: string) => {
    const normalizedType = fileType.toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(normalizedType)) {
      return locale === "zh" ? "截图" : "Image";
    }
    if ([".csv", ".tsv", ".xlsx", ".xls"].includes(normalizedType)) {
      return locale === "zh" ? "表格" : "Spreadsheet";
    }
    if ([".py", ".js", ".ts", ".java", ".go"].includes(normalizedType)) {
      return locale === "zh" ? "代码" : "Code";
    }
    if ([".json", ".xml", ".yaml", ".yml", ".log", ".srt", ".vtt"].includes(normalizedType)) {
      return locale === "zh" ? "结构化/日志" : "Structured";
    }
    if ([".doc", ".docx", ".ppt", ".pptx", ".pdf", ".txt", ".md", ".html", ".htm", ".rtf"].includes(normalizedType)) {
      return locale === "zh" ? "文档" : "Document";
    }
    return normalizedType.replace(".", "").toUpperCase();
  };

  const getDocumentTypeBadgeClassName = (fileType: string) => {
    const normalizedType = fileType.toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(normalizedType)) {
      return "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300";
    }
    if ([".csv", ".tsv", ".xlsx", ".xls"].includes(normalizedType)) {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
    }
    if ([".py", ".js", ".ts", ".java", ".go"].includes(normalizedType)) {
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
    }
    if ([".json", ".xml", ".yaml", ".yml", ".log", ".srt", ".vtt"].includes(normalizedType)) {
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    }
    if ([".doc", ".docx", ".ppt", ".pptx", ".pdf", ".txt", ".md", ".html", ".htm", ".rtf"].includes(normalizedType)) {
      return "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300";
    }
    return "bg-muted text-muted-foreground";
  };

  const getDocumentTypeTheme = (fileType: string) => {
    const normalizedType = fileType.toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(normalizedType)) {
      return {
        iconBg: "bg-fuchsia-100 dark:bg-fuchsia-950/50",
        iconText: "text-fuchsia-700 dark:text-fuchsia-300",
        panelBg: "bg-fuchsia-50/70 dark:bg-fuchsia-950/20",
        panelBorder: "border-fuchsia-200 dark:border-fuchsia-900",
        progressBar: "bg-fuchsia-500",
      };
    }
    if ([".csv", ".tsv", ".xlsx", ".xls"].includes(normalizedType)) {
      return {
        iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
        iconText: "text-emerald-700 dark:text-emerald-300",
        panelBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
        panelBorder: "border-emerald-200 dark:border-emerald-900",
        progressBar: "bg-emerald-500",
      };
    }
    if ([".py", ".js", ".ts", ".java", ".go"].includes(normalizedType)) {
      return {
        iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
        iconText: "text-indigo-700 dark:text-indigo-300",
        panelBg: "bg-indigo-50/70 dark:bg-indigo-950/20",
        panelBorder: "border-indigo-200 dark:border-indigo-900",
        progressBar: "bg-indigo-500",
      };
    }
    if ([".json", ".xml", ".yaml", ".yml", ".log", ".srt", ".vtt"].includes(normalizedType)) {
      return {
        iconBg: "bg-amber-100 dark:bg-amber-950/50",
        iconText: "text-amber-700 dark:text-amber-300",
        panelBg: "bg-amber-50/70 dark:bg-amber-950/20",
        panelBorder: "border-amber-200 dark:border-amber-900",
        progressBar: "bg-amber-500",
      };
    }
    if ([".doc", ".docx", ".ppt", ".pptx", ".pdf", ".txt", ".md", ".html", ".htm", ".rtf"].includes(normalizedType)) {
      return {
        iconBg: "bg-sky-100 dark:bg-sky-950/50",
        iconText: "text-sky-700 dark:text-sky-300",
        panelBg: "bg-sky-50/70 dark:bg-sky-950/20",
        panelBorder: "border-sky-200 dark:border-sky-900",
        progressBar: "bg-sky-500",
      };
    }
    return {
      iconBg: "bg-muted",
      iconText: "text-muted-foreground",
      panelBg: "bg-white/70 dark:bg-muted/20",
      panelBorder: "border-border",
      progressBar: "bg-blue-500",
    };
  };

  const processingDocuments = documents.filter((doc) => doc.status === "processing");

  return (
    <AppShell>
<div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right fade-in duration-200 ${
              toast.type === "success"
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
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold mb-2">{t("knowledgeTitle")}</h1>
              <p className="text-muted-foreground">{t("knowledgeSubtitle")}</p>
            </div>

            <div>
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
                className="rounded-lg"
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
            </div>
          </div>
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  selfOllamaServiceReady
                    ? selfOllamaModelReady
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : "bg-gray-400"
                }`}
              />
              <div>
                <p className="text-sm font-medium">
                  {t("knowledgeUseLocalEmbedding")}
                </p>
                <p className="text-xs text-gray-500">
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useLocalEmbedding && selfOllamaServiceReady
                  ? "bg-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              } ${!selfOllamaServiceReady ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useLocalEmbedding ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {processingDocuments.length > 0 && (
            <div className="mb-6 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/20 p-4">
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
                      className={`rounded-lg border px-3 py-2 ${theme.panelBg} ${theme.panelBorder}`}
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={`truncate font-medium ${theme.iconText}`}>
                          {doc.title}
                        </span>
                        <span className={`shrink-0 text-xs ${theme.iconText}`}>
                          {progress?.percent ?? 0}%
                        </span>
                      </div>
                      <div className={`mt-2 h-2 overflow-hidden rounded-full ${theme.panelBg}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${theme.progressBar}`}
                          style={{ width: `${progress?.percent ?? 0}%` }}
                        />
                      </div>
                      <p className={`mt-2 text-xs ${theme.iconText} opacity-80`}>
                        {message || t("knowledgeLoadingDocumentContent")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
<div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
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
          </div>
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
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
                                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
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
                          className={`p-2 rounded-lg transition-colors ${
                            canPreview
                              ? "hover:bg-primary/10 hover:text-primary"
                              : "opacity-40 cursor-not-allowed"
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
        </div>
      </main>
<Dialog open={!!viewingDoc} onOpenChange={(open) => !open && closeViewModal()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0">
          {viewingDoc && (
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
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
                      className={`mr-1 inline-flex items-center rounded-full px-2 py-0.5 font-medium ${getDocumentTypeBadgeClassName(viewingDoc.file_type)}`}
                    >
                      {getDocumentTypeLabel(viewingDoc.file_type)}
                    </span>
                    •{" "}
                    {viewingDoc.file_type.toUpperCase()} •{" "}
                    {new Date(viewingDoc.created_at).toLocaleDateString()}
                  </p>
                </div>
                </div>
                <button
                  onClick={closeViewModal}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {docInfo.total_pages && (
                <div className="flex items-center gap-4 px-6 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground">
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
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {t("knowledgeLoadingDocumentContent")}
                  </p>
                </div>
              ) : isPdfPreview ? (
                <div className="h-full min-h-[480px] rounded-lg overflow-hidden border border-border bg-muted/30">
                  <iframe
                    src={`${API_BASE_URL}/api/documents/${viewingDoc.id}/file`}
                    title={viewingDoc.title}
                    className="w-full h-full min-h-[480px]"
                  />
                </div>
              ) : isMarkdownPreview ? (
                <div className="max-w-none">
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
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-muted p-4 rounded-lg overflow-x-auto">
                    {docContent}
                  </pre>
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






