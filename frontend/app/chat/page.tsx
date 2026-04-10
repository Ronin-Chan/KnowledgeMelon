"use client";

import { useState, useRef, useEffect } from "react";
import {
    useSettingsStore,
    SUPPORTED_MODELS,
    PROVIDERS,
    getLocalizedModels,
} from "@/stores/settings";
import { Message } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
    Plus,
    Search,
    Grid3X3,
    BookOpen,
    Brain,
    Settings,
    Menu,
    X,
    Paperclip,
    Mic,
    ArrowUp,
    MessageSquare,
    Check,
    Copy,
    RotateCcw,
    Trash2,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/api";
import { resolveEmbeddingConfig } from "@/lib/embedding";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";

type SpeechRecognitionResultLike = {
    transcript: string;
};

type SpeechRecognitionAlternativeLike = [SpeechRecognitionResultLike];

type SpeechRecognitionEventLike = {
    resultIndex: number;
    results: Array<SpeechRecognitionAlternativeLike>;
};

type SpeechRecognitionErrorEventLike = {
    error: string;
};

type SpeechRecognitionInstance = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface Conversation {
    id: string;
    title: string;
    model: string;
    updated_at: string;
    message_count: number;
}

interface SessionAttachment {
    id: string;
    name: string;
    fileType: string;
    content: string;
    truncated?: boolean;
}

interface PendingKnowledgeAttachment {
    id: string;
    file: File;
    name: string;
}

export default function ChatPage() {
    const t = useT();
    const locale = useLocale();
    const localizedModels = getLocalizedModels(locale);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [filteredConversations, setFilteredConversations] = useState<
        Conversation[]
    >([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [sessionAttachments, setSessionAttachments] = useState<
        SessionAttachment[]
    >([]);
    const [pendingKnowledgeAttachments, setPendingKnowledgeAttachments] =
        useState<PendingKnowledgeAttachment[]>([]);
    const [selectedKnowledgeAttachmentIds, setSelectedKnowledgeAttachmentIds] =
        useState<string[]>([]);
    const [isKnowledgePromptOpen, setIsKnowledgePromptOpen] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<
        string | null
    >(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [pendingDeleteConversation, setPendingDeleteConversation] = useState<
        string | null
    >(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const manualStopRef = useRef(false);
    const dragDepthRef = useRef(0);
    const {
        model,
        setModel,
        setSelectedProvider,
        getEffectiveApiKey,
        apiKeys,
        openaiApiKey,
        baseUrls,
        useRAG,
        useMemory,
        useTools,
        useLocalEmbedding,
        setUseRAG,
        setUseMemory,
        setUseTools,
    } = useSettingsStore();
    const apiKey = getEffectiveApiKey();
    const currentModel = localizedModels.find((m) => m.id === model);
    const modelProvider = currentModel?.provider || "openai";
    const embeddingConfig = resolveEmbeddingConfig({
        apiKeys,
        openaiApiKey,
        baseUrls,
        currentProvider: modelProvider,
        useLocalEmbedding,
    });
    const currentProvider = PROVIDERS.find(
        (p) => p.id === currentModel?.provider,
    );

    // 加载对话列表
    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations`);
            if (response.ok) {
                const data = await response.json();
                setConversations(data);
                setFilteredConversations(data);
            }
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
        }
    };

    // Search conversations
    const handleSearchConversations = async () => {
        if (!searchQuery.trim()) {
            setFilteredConversations(conversations);
            return;
        }

        setIsSearching(true);
        try {
            const params = new URLSearchParams();
            params.append("q", searchQuery);
            const response = await fetch(
                `${API_BASE_URL}/api/conversations/search?${params.toString()}`,
            );
            if (response.ok) {
                const data = await response.json();
                setFilteredConversations(data);
            }
        } catch (error) {
            console.error("Failed to search conversations:", error);
            // Fallback to client-side filtering
            const filtered = conversations.filter((c) =>
                c.title.toLowerCase().includes(searchQuery.toLowerCase()),
            );
            setFilteredConversations(filtered);
        } finally {
            setIsSearching(false);
        }
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery("");
        setFilteredConversations(conversations);
    };

    const createNewConversation = async () => {
        clearCurrentSessionAttachments();
        if (messages.length === 0) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: t("chatNewConversationTitle"), model }),
            });
            if (response.ok) {
                const data = await response.json();
                setCurrentConversationId(data.id);
                setMessages([]);
                clearCurrentSessionAttachments();
                fetchConversations();
            }
        } catch (error) {
            console.error("Failed to create conversation:", error);
        }
    };

    const loadConversation = async (conversationId: string) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/conversations/${conversationId}`,
            );
            if (response.ok) {
                const data: {
                    id: string;
                    model: string;
                    messages: Array<{
                        id: string;
                        role: "user" | "assistant";
                        content: string;
                        created_at: string;
                    }>;
                } = await response.json();
                setCurrentConversationId(data.id);
                setMessages(
                    data.messages.map((m) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        createdAt: m.created_at,
                    })),
                );
                clearCurrentSessionAttachments();
                // 设置当前模型
                const convModel = SUPPORTED_MODELS.find((m) => m.id === data.model);
                if (convModel) {
                    setModel(data.model);
                    setSelectedProvider(convModel.provider);
                }
            }
        } catch (error) {
            console.error("Failed to load conversation:", error);
        }
    };

    const handleDeleteConversation = async (conversationId: string) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/conversations/${conversationId}`,
                {
                    method: "DELETE",
                },
            );

            if (!response.ok) {
                throw new Error(`${t("chatDeleteConversationFailed")} (${response.status})`);
            }

            setConversations((prev) => prev.filter((c) => c.id !== conversationId));
            setFilteredConversations((prev) =>
                prev.filter((c) => c.id !== conversationId),
            );

            if (currentConversationId === conversationId) {
                startNewChat();
            }

            fetchConversations();
        } catch (error) {
            console.error("Failed to delete conversation:", error);
            setErrorMessage(t("chatDeleteConversationFailed"));
        }
        setPendingDeleteConversation(null);
    };

    // 格式化日期
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return t("chatToday");
        if (days === 1) return t("chatYesterday");
        if (days < 7) return t("chatDaysAgo", { days });
        return date.toLocaleDateString();
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200,
            )}px`;
        }
    }, [input]);

    useEffect(() => {
        if (!statusMessage) return;
        const timer = window.setTimeout(() => setStatusMessage(null), 4000);
        return () => window.clearTimeout(timer);
    }, [statusMessage]);

    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
            recognitionRef.current = null;
        };
    }, []);

    const showStatus = (message: string) => {
        setStatusMessage(message);
    };

    const clearCurrentSessionAttachments = () => {
        setSessionAttachments([]);
        setPendingKnowledgeAttachments([]);
        setSelectedKnowledgeAttachmentIds([]);
        setIsKnowledgePromptOpen(false);
    };

    const parseTemporaryAttachment = async (file: File) => {
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const allowedTypes = ["pdf", "docx", "txt", "md"];
        if (!fileExt || !allowedTypes.includes(fileExt)) {
            setErrorMessage(
                t("chatUploadUnsupportedFileType", {
                    types: allowedTypes.join(", "),
                }),
            );
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/attachments/preview`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let errorMsg = t("chatUploadFailed");
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorData.message || errorMsg;
                } catch {
                    errorMsg = await response.text();
                }
                throw new Error(errorMsg);
            }

            const data: {
                name: string;
                file_type: string;
                content: string;
                truncated?: boolean;
            } = await response.json();

            return {
                id: uuidv4(),
                file,
                preview: {
                    id: uuidv4(),
                    name: data.name,
                    fileType: data.file_type,
                    content: data.content,
                    truncated: data.truncated,
                } as SessionAttachment,
            };
        } catch (error) {
            console.error("Attachment upload error:", error);
            throw error;
        }
    };

    const attachFilesToCurrentSession = async (files: File[]) => {
        const validFiles = files.filter((file) => {
            const fileExt = file.name.split(".").pop()?.toLowerCase();
            return fileExt && ["pdf", "docx", "txt", "md"].includes(fileExt);
        });

        if (validFiles.length === 0) {
            setErrorMessage(
                t("chatUploadUnsupportedFileType", {
                    types: ["pdf", "docx", "txt", "md"].join(", "),
                }),
            );
            return;
        }

        setIsUploadingFile(true);
        showStatus(
            t("chatUploading") + ` (${validFiles.length}/${files.length})`,
        );

        const previews: Array<{
            id: string;
            file: File;
            preview: SessionAttachment;
        }> = [];

        try {
            for (const file of validFiles) {
                const result = await parseTemporaryAttachment(file);
                if (result) {
                    previews.push(result);
                }
            }

            if (previews.length === 0) {
                return;
            }

            setSessionAttachments((prev) => [
                ...prev,
                ...previews.map((item) => item.preview),
            ]);
            setPendingKnowledgeAttachments((prev) => [
                ...prev,
                ...previews.map((item) => ({
                    id: item.id,
                    file: item.file,
                    name: item.preview.name,
                })),
            ]);
            setSelectedKnowledgeAttachmentIds((prev) => [
                ...new Set([
                    ...prev,
                    ...previews.map((item) => item.id),
                ]),
            ]);
            setIsKnowledgePromptOpen(true);
            showStatus(
                previews.length > 1
                    ? t("chatAttachmentsAttached", { count: previews.length })
                    : t("chatAttachmentAttached", {
                          name: previews[0].preview.name,
                      }),
            );
        } catch (error) {
            console.error("Attachment upload error:", error);
            setErrorMessage(
                error instanceof Error ? error.message : t("chatUploadFailed"),
            );
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const uploadDocumentToKnowledgeBase = async (file: File) => {
        if (!embeddingConfig) {
            setErrorMessage(
                t("chatUploadMissingApiKey", {
                    provider: currentProvider?.name || t("settingsModelLabel"),
                }),
            );
            return;
        }

        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const allowedTypes = ["pdf", "docx", "txt", "md"];
        if (!fileExt || !allowedTypes.includes(fileExt)) {
            setErrorMessage(
                t("chatUploadUnsupportedFileType", {
                    types: allowedTypes.join(", "),
                }),
            );
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setIsUploadingFile(true);
        showStatus(t("chatUploading"));

        try {
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

            const response = await fetch(
                `${API_BASE_URL}/api/documents/upload?${params.toString()}`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            if (!response.ok) {
                let errorMsg = t("chatUploadFailed");
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorData.message || errorMsg;
                } catch {
                    errorMsg = await response.text();
                }
                throw new Error(errorMsg);
            }

            showStatus(t("chatUploadSuccess", { name: file.name }));
            if (!useRAG) {
                setUseRAG(true);
            }
            await fetchConversations();
            window.dispatchEvent(new Event("knowledge-documents-updated"));
        } catch (error) {
            console.error("Upload error:", error);
            const message =
                error instanceof Error ? error.message : t("chatUploadFailed");
            setErrorMessage(message);
            throw error;
        } finally {
            setIsUploadingFile(false);
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
        await attachFilesToCurrentSession(files);
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingFile(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setIsDraggingFile(false);

        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length === 0 || isUploadingFile) return;
        await attachFilesToCurrentSession(files);
    };

    const handleRemoveAttachment = (attachmentId: string) => {
        setSessionAttachments((prev) =>
            prev.filter((attachment) => attachment.id !== attachmentId),
        );
        setPendingKnowledgeAttachments((prev) =>
            prev.filter((attachment) => attachment.id !== attachmentId),
        );
        setSelectedKnowledgeAttachmentIds((prev) =>
            prev.filter((id) => id !== attachmentId),
        );
    };

    const handleAttachToKnowledgeBase = async () => {
        const selected = pendingKnowledgeAttachments.filter((attachment) =>
            selectedKnowledgeAttachmentIds.includes(attachment.id),
        );

        if (selected.length === 0) {
            setIsKnowledgePromptOpen(false);
            return;
        }

        try {
            for (const attachment of selected) {
                await uploadDocumentToKnowledgeBase(attachment.file);
            }
            setIsKnowledgePromptOpen(false);
            setPendingKnowledgeAttachments([]);
            setSelectedKnowledgeAttachmentIds([]);
        } catch (error) {
            console.error("Failed to add file to knowledge base:", error);
        }
    };

    const handleKeepCurrentSessionOnly = () => {
        setIsKnowledgePromptOpen(false);
        setPendingKnowledgeAttachments([]);
        setSelectedKnowledgeAttachmentIds([]);
    };

    const startVoiceInput = () => {
        const speechRecognitionWindow = window as Window & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
        };
        const SpeechRecognitionImpl =
            speechRecognitionWindow.SpeechRecognition ||
            speechRecognitionWindow.webkitSpeechRecognition;
        if (!SpeechRecognitionImpl) {
            setErrorMessage(t("chatSpeechUnsupported"));
            return;
        }

        const recognition = new SpeechRecognitionImpl();
        let receivedTranscript = false;
        manualStopRef.current = false;
        recognition.lang = locale === "zh" ? "zh-CN" : "en-US";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }
            const cleaned = transcript.trim();
            if (cleaned) {
                receivedTranscript = true;
                setInput((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                setErrorMessage(t("chatSpeechNotAllowed"));
            } else if (event.error !== "aborted") {
                setErrorMessage(t("chatSpeechUnsupported"));
            }
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
            if (!manualStopRef.current && !receivedTranscript) {
                setErrorMessage(t("chatSpeechNoResult"));
            }
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        showStatus(t("chatSpeechListening"));
        recognition.start();
    };

    const stopVoiceInput = () => {
        manualStopRef.current = true;
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setIsListening(false);
    };

    const toggleVoiceInput = () => {
        if (isListening) {
            stopVoiceInput();
            return;
        }
        startVoiceInput();
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        setErrorMessage(null);
        if (!apiKey) {
            setErrorMessage(
                t("chatApiKeyError", {
                    provider: currentProvider?.name || t("settingsModelLabel"),
                }),
            );
            return;
        }

        // 如果没有当前对话，自动创建
        let conversationId = currentConversationId;
        if (!conversationId) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/conversations`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: t("chatNewConversationTitle"),
                        model,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    conversationId = data.id;
                    setCurrentConversationId(data.id);
                    // 刷新对话列表
                    fetchConversations();
                }
            } catch (error) {
                console.error("Failed to create conversation:", error);
            }
        }

        const userMessage: Message = {
            id: uuidv4(),
            role: "user",
            content: input.trim(),
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const shouldUseAdvancedEndpoint = useRAG || useMemory || useTools;
            const endpoint = shouldUseAdvancedEndpoint ? "/api/chat/rag" : "/api/chat";
            // 构建历史消息（排除当前消息，最多50轮/100条）
            const MAX_HISTORY_MESSAGES = 100;
            const historyMessages = messages
                .slice(-MAX_HISTORY_MESSAGES)
                .map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                }));

            const requestBody = {
                message: userMessage.content,
                history: historyMessages,
                conversationId,
                apiKey,
                model,
                baseUrl: currentModel?.provider ? baseUrls[currentModel.provider] : undefined,
                attachments: sessionAttachments.map((attachment) => ({
                    name: attachment.name,
                    file_type: attachment.fileType,
                    content: attachment.content,
                })),
            };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    shouldUseAdvancedEndpoint
                        ? {
                            ...requestBody,
                            use_rag: useRAG,
                            use_memory: useMemory,
                            use_tools: useTools,
                        }
                        : requestBody,
                ),
            });

            // 检查 HTTP 响应状态码，处理后端返回的错误
            if (!response.ok) {
                let errMsg = `${t("chatDeleteConversationFailed")} (${response.status})`;
                try {
                    const errData = await response.json();
                    errMsg = errData.detail || errData.message || errMsg;
                } catch {
                    // 无法解析 JSON，使用默认错误信息
                }
                throw new Error(errMsg);
            }

            if (!response.body) throw new Error("No response body");

            const assistantMessage: Message = {
                id: uuidv4(),
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);

                // 检测后端流式传递的错误信息
                if (
                    chunk.startsWith("[ERROR]") ||
                    (assistantMessage.content === "" && chunk.includes("[ERROR]"))
                ) {
                    const errText = (assistantMessage.content + chunk)
                        .replace("[ERROR]", "")
                        .trim();
                    // 移除空的 assistant 消息
                    setMessages((prev) =>
                        prev.filter((msg) => msg.id !== assistantMessage.id),
                    );
                    throw new Error(errText || t("chatDeleteConversationFailed"));
                }

                assistantMessage.content += chunk;
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessage.id
                            ? { ...msg, content: assistantMessage.content }
                            : msg,
                    ),
                );
            }
        } catch (error) {
            console.error("Chat error:", error);
            const msg = error instanceof Error ? error.message : t("chatDeleteConversationFailed");
            setErrorMessage(`${msg}`);
        } finally {
            setIsLoading(false);
            if (conversationId) {
                await fetchConversations();
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setInput("");
        setCurrentConversationId(null);
        clearCurrentSessionAttachments();
    };

    const handleCopyMessage = async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(messageId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const handleRegenerate = async () => {
        // Find last user message
        const lastUserIndex = [...messages]
            .reverse()
            .findIndex((m) => m.role === "user");
        if (lastUserIndex === -1) return;

        const lastUserMsg = messages[messages.length - 1 - lastUserIndex];

        // Remove the last assistant message if exists
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "assistant") {
            setMessages((prev) => prev.slice(0, -1));
        }

        // Trigger a new send with the last user message
        setInput(lastUserMsg.content);
        // Use setTimeout to ensure the input state is updated before sending
        setTimeout(() => {
            const sendButton = document.querySelector(
                '[data-send-button="true"]',
            ) as HTMLButtonElement;
            sendButton?.click();
        }, 0);
    };

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? "w-72" : "w-0"
                    } bg-[#f9f9f9] dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden flex flex-col`}
            >
                {/* New Chat Button */}
                <div className="p-4">
                    <button
                        onClick={createNewConversation}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        <Plus className="h-4 w-4 text-gray-500" />
                        {t("chatNewConversation")}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3">
                    {/* Search */}
                    <div className="px-1 py-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t("chatSearchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSearchConversations();
                                    }
                                }}
                                className="w-full pl-9 pr-8 py-2 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 dark:focus:border-gray-700"
                            />
                            {searchQuery && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                >
                                    <X className="h-3 w-3 text-gray-400" />
                                </button>
                            )}
                        </div>
                        {isSearching && (
                            <p className="text-xs text-gray-400 mt-1 px-3">{t("chatSearchLoading")}</p>
                        )}
                    </div>

                    {/* Features */}
                    <div className="mt-1 space-y-0.5">
                        <Link
                            href="/"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
                        >
                            <Grid3X3 className="h-4 w-4" />
                            {t("navHome")}
                        </Link>
                        <Link
                            href="/knowledge"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
                        >
                            <BookOpen className="h-4 w-4" />
                            {t("navKnowledge")}
                        </Link>
                        <Link
                            href="/memories"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
                        >
                            <Brain className="h-4 w-4" />
                            {t("navMemories")}
                        </Link>
                        <Link
                            href="/settings"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
                        >
                            <Settings className="h-4 w-4" />
                            {t("navSettings")}
                        </Link>
                    </div>

                    {/* Toggle Features */}
                    <div className="mt-6 px-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-3">
                            {t("chatFeatureSwitch")}
                        </p>
                        <div className="space-y-0.5">
                            <button
                                onClick={() => setUseRAG(!useRAG)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full ${useRAG
                                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                            >
                                <BookOpen className="h-4 w-4" />
                                <span className="flex-1 text-left">{t("chatRagToggle")}</span>
                                {useRAG && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                )}
                            </button>
                            <button
                                onClick={() => setUseMemory(!useMemory)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full ${useMemory
                                    ? "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                            >
                                <Brain className="h-4 w-4" />
                                <span className="flex-1 text-left">{t("chatMemoryToggle")}</span>
                                {useMemory && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                )}
                            </button>
                            <button
                                onClick={() => setUseTools(!useTools)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer w-full ${useTools
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                            >
                                <Search className="h-4 w-4" />
                                <span className="flex-1 text-left">{t("chatWebSearchToggle")}</span>
                                {useTools && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Recent Chats */}
                    <div className="mt-6 px-1">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-3">
                            {searchQuery
                                ? `${t("chatSearchResultsHeader")} (${filteredConversations.length})`
                                : `${t("chatRecentHeader")} (${conversations.length})`}
                        </p>
                        <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                            {filteredConversations.length === 0 && searchQuery ? (
                                <p className="text-sm text-gray-400 px-3 py-2">
                                    {t("chatNoMatchesHint")}
                                </p>
                            ) : (
                                filteredConversations.map((chat) => (
                                    <div
                                        key={chat.id}
                                        className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm transition-all w-full ${currentConversationId === chat.id
                                            ? "bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                                            }`}
                                    >
                                        <button
                                            onClick={() => loadConversation(chat.id)}
                                            className="flex flex-1 items-start gap-3 text-left min-w-0"
                                        >
                                            <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                                            <div className="flex-1 min-w-0">
                                                <span className="truncate block font-medium">
                                                    {chat.title}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {formatDate(chat.updated_at)} · {t("chatMessageCount", {
                                                        count: chat.message_count,
                                                    })}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingDeleteConversation(chat.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 transition-all"
                                            title={t("chatDeleteConversation")}
                                            aria-label={t("chatDeleteConversation")}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0d0d0d]">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                        >
                            {sidebarOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>
                        <Select
                            value={model}
                            onValueChange={(value) => {
                                const m = SUPPORTED_MODELS.find((mod) => mod.id === value);
                                if (m) {
                                    setModel(m.id);
                                    setSelectedProvider(m.provider);
                                }
                            }}
                        >
                            <SelectTrigger className="w-[320px] text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                <SelectValue placeholder={t("chatSelectModel")}>
                                    {currentModel && (
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {currentModel.name}
                                            </span>
                                            <span className="text-gray-500 text-xs truncate">
                                                {
                                                    PROVIDERS.find((p) => p.id === currentModel.provider)
                                                        ?.name
                                                }
                                            </span>
                                        </div>
                                    )}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[500px] w-[360px]">
                                {localizedModels.map((m) => (
                                    <SelectItem
                                        key={m.id}
                                        value={m.id}
                                        className="py-3 h-auto whitespace-normal"
                                    >
                                        <div className="flex flex-col items-start gap-1 w-full max-w-[360px]">
                                            <span className="font-medium text-sm truncate w-full">
                                                {m.name}
                                            </span>
                                            <span className="text-xs text-gray-500 leading-relaxed break-words w-full">
                                                {PROVIDERS.find((p) => p.id === m.provider)?.name} ·{" "}
                                                {m.descriptionKey}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto">
                    {messages.length === 0 ? (
                        // Welcome Screen
                        <div className="flex flex-col items-center justify-center h-full px-4">
                            <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-10 tracking-tight">
                                {t("chatWelcome")}
                            </h1>

                            {/* Suggestions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full mb-8">
                                {[
                                    t("chatSuggestion1"),
                                    t("chatSuggestion2"),
                                    t("chatSuggestion3"),
                                    t("chatSuggestion4"),
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setInput(suggestion)}
                                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all text-left text-sm text-gray-700 dark:text-gray-300"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Messages
                        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-4 group ${message.role === "user" ? "flex-row-reverse" : ""
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div
                                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${message.role === "user"
                                            ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                            }`}
                                    >
                                        {message.role === "user" ? "U" : "AI"}
                                    </div>

                                    {/* Content */}
                                    <div
                                        className={`flex-1 ${message.role === "user" ? "text-right" : ""
                                            }`}
                                    >
                                        <div
                                            className={`inline-block text-left max-w-[85%] px-4 py-3 rounded-2xl ${message.role === "user"
                                                ? "bg-gray-900 dark:bg-blue-600 text-white rounded-br-md"
                                                : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-md shadow-sm"
                                                }`}
                                        >
                                            {message.role === "assistant" &&
                                                !message.content &&
                                                isLoading &&
                                                messages[messages.length - 1]?.id === message.id ? (
                                                <div className="flex items-center gap-2 py-1">
                                                    <span
                                                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                                                        style={{ animationDelay: "0ms" }}
                                                    />
                                                    <span
                                                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                                                        style={{ animationDelay: "150ms" }}
                                                    />
                                                    <span
                                                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                                                        style={{ animationDelay: "300ms" }}
                                                    />
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap leading-relaxed">
                                                    {message.content}
                                                </p>
                                            )}
                                        </div>

                                        {/* Message Actions - Only for assistant messages */}
                                        {message.role === "assistant" && (
                                            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() =>
                                                        handleCopyMessage(message.content, message.id)
                                                    }
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                                                    title={t("chatCopy")}
                                                >
                                                    {copiedId === message.id ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                                {messages[messages.length - 1].id === message.id &&
                                                    !isLoading && (
                                                        <button
                                                            onClick={handleRegenerate}
                                                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                                                            title={t("chatRegenerate")}
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <AlertDialog
                    open={pendingDeleteConversation !== null}
                    onOpenChange={(open) => !open && setPendingDeleteConversation(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("chatDeleteConversation")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("chatDeleteConversationBody")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("chatCancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (pendingDeleteConversation) {
                                        handleDeleteConversation(pendingDeleteConversation);
                                    }
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {t("chatDelete")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog
                    open={isKnowledgePromptOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            handleKeepCurrentSessionOnly();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("chatAttachmentPromptTitle")}</DialogTitle>
                            <DialogDescription>
                                {t("chatAttachmentPromptBody")}
                            </DialogDescription>
                        </DialogHeader>
                        {pendingKnowledgeAttachments.length > 0 && (
                            <div className="mt-2 space-y-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-3">
                                <div className="flex items-center justify-between gap-2 px-1">
                                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                        {t("chatAttachmentChecklist")}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedKnowledgeAttachmentIds(
                                                    pendingKnowledgeAttachments.map((item) => item.id),
                                                )
                                            }
                                            className="text-primary hover:underline"
                                        >
                                            {t("chatAttachmentSelectAll")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedKnowledgeAttachmentIds([])}
                                            className="text-gray-500 hover:underline"
                                        >
                                            {t("chatAttachmentClearSelection")}
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto space-y-2">
                                    {pendingKnowledgeAttachments.map((attachment) => {
                                        const checked = selectedKnowledgeAttachmentIds.includes(
                                            attachment.id,
                                        );
                                        return (
                                            <label
                                                key={attachment.id}
                                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setSelectedKnowledgeAttachmentIds(
                                                            (prev) =>
                                                                e.target.checked
                                                                    ? Array.from(
                                                                        new Set([
                                                                            ...prev,
                                                                            attachment.id,
                                                                        ]),
                                                                    )
                                                                    : prev.filter(
                                                                        (id) =>
                                                                            id !==
                                                                            attachment.id,
                                                                    ),
                                                        );
                                                    }}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                                                        {attachment.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {attachment.file.name
                                                            .split(".")
                                                            .pop()
                                                            ?.toLowerCase()}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleKeepCurrentSessionOnly}
                                    className="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {t("chatAttachmentKeepCurrent")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleAttachToKnowledgeBase()}
                                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    {t("chatAttachmentAddToKnowledge")}
                                </button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 错误提示横幅 */}
                {errorMessage && (
                    <div className="px-4 pt-2">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm shadow-sm">
                                <span className="font-medium">{errorMessage}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        href="/settings"
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                                    >
                                        {t("chatGoToSettings")}
                                    </Link>
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="px-4 pb-6 pt-2">
                    <div className="max-w-3xl mx-auto">
                        <div
                            className={`bg-white dark:bg-gray-900 rounded-3xl border shadow-lg hover:shadow-xl transition-shadow ${isDraggingFile
                                ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900/40"
                                : "border-gray-200 dark:border-gray-800"
                                }`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.txt,.md"
                                multiple
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            {sessionAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-4 pt-4">
                                    {sessionAttachments.map((attachment) => (
                                        <div
                                            key={attachment.id}
                                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-300"
                                        >
                                            <span className="max-w-[180px] truncate">
                                                {attachment.name}
                                            </span>
                                            <span className="text-gray-400 uppercase">
                                                {attachment.fileType.replace(".", "")}
                                            </span>
                                            {attachment.truncated && (
                                                <span className="text-amber-500">
                                                    {t("chatAttachmentTruncated")}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(attachment.id)}
                                                className="ml-1 rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                aria-label={t("chatAttachmentRemove")}
                                                title={t("chatAttachmentRemove")}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Input Actions - Top Row */}
                            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                                <button
                                    type="button"
                                    onClick={triggerFileUpload}
                                    disabled={isUploadingFile}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500 disabled:opacity-50"
                                    title={t("chatUploadFile")}
                                    aria-label={t("chatUploadFile")}
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleVoiceInput}
                                    className={`p-2 rounded-xl transition-colors ${isListening
                                        ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                                        }`}
                                    title={isListening ? t("chatSpeechStop") : t("chatSpeechStart")}
                                    aria-label={isListening ? t("chatSpeechStop") : t("chatSpeechStart")}
                                >
                                    <Mic className="h-5 w-5" />
                                </button>
                            </div>

                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t("chatSendingPlaceholder")}
                                className="w-full min-h-[40px] max-h-[200px] bg-transparent resize-none px-4 pb-3 pt-1 text-base focus:outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                                rows={1}
                            />

                            {/* Send Button */}
                            <div className="flex justify-end px-3 pb-3">
                                <button
                                    data-send-button="true"
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className={`p-2.5 rounded-xl transition-all ${input.trim() && !isLoading
                                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                        }`}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Features indicator */}
                        <div className="flex items-center justify-center gap-2 mt-3">
                            {useRAG && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full font-medium">
                                    <BookOpen className="h-3 w-3" />
                                    {t("chatRagEnabled")}
                                </span>
                            )}
                            {useMemory && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full font-medium">
                                    <Brain className="h-3 w-3" />
                                    {t("chatMemoryEnabled")}
                                </span>
                            )}
                            {useTools && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full font-medium">
                                    <Search className="h-3 w-3" />
                                    {t("chatWebSearchEnabled")}
                                </span>
                            )}
                        </div>

                        {statusMessage && (
                            <p className="text-xs text-center mt-3 text-gray-500">
                                {statusMessage}
                            </p>
                        )}

                        <p className="text-xs text-gray-400 text-center mt-3">
                            {t("chatDisclaimer")}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
