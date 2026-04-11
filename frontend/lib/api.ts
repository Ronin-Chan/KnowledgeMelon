import { useAuthStore } from "@/stores/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatRequest {
  message: string;
  conversationId?: string;
  apiKey: string;
  model: string;
}

function buildUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildUrl(path), {
    ...init,
    headers,
  });
}

export const chatApi = {
  sendMessage: async (
    data: ChatRequest,
  ): Promise<ReadableStream<Uint8Array>> => {
    const response = await apiFetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.body) {
      throw new Error("No response body");
    }

    return response.body;
  },
};
