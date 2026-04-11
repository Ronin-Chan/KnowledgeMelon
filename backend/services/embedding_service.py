from typing import List, Optional

from core.ollama import build_ollama_url, get_ollama_request_kwargs
from core.config import settings


class EmbeddingService:
    PROVIDER_BASE_URLS = {
        "openai": "https://api.openai.com/v1",
        "alibaba": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "zhipu": "https://open.bigmodel.cn/api/paas/v4",
        "moonshot": "https://api.moonshot.cn/v1",
    }

    PROVIDER_MODELS = {
        "openai": "text-embedding-3-small",
        "alibaba": "text-embedding-v3",
        "zhipu": "embedding-3",
        "moonshot": "moonshot-embedding",
    }

    async def get_embeddings(
        self,
        texts: List[str],
        api_key: str,
        provider: str = "openai",
        base_url: Optional[str] = None,
        use_local: bool = False,
    ) -> List[List[float]]:
        if use_local:
            return await self._get_ollama_embeddings(
                texts,
                settings.ollama_base_url,
                settings.ollama_embedding_model,
            )

        url = base_url if base_url else self.PROVIDER_BASE_URLS.get(provider)
        model = self.PROVIDER_MODELS.get(provider, "text-embedding-3-small")

        if provider == "zhipu":
            import asyncio
            from zhipuai import ZhipuAI

            clean_api_key = str(api_key).strip()
            if clean_api_key.lower().startswith("bearer "):
                clean_api_key = clean_api_key[7:].strip()

            if not base_url or "bigmodel.cn" in base_url:
                client = ZhipuAI(api_key=clean_api_key)
                resp = await asyncio.to_thread(
                    client.embeddings.create,
                    model="embedding-3",
                    input=texts,
                )
                return [item.embedding for item in resp.data]

            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            resp = await client.embeddings.create(model="embedding-3", input=texts)
            return [item.embedding for item in resp.data]

        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key, base_url=url)
        resp = await client.embeddings.create(model=model, input=texts)
        return [item.embedding for item in resp.data]

    async def get_single_embedding(
        self,
        text: str,
        api_key: str,
        provider: str = "openai",
        base_url: Optional[str] = None,
        use_local: bool = False,
    ) -> List[float]:
        embeddings = await self.get_embeddings(
            [text], api_key, provider, base_url, use_local
        )
        return embeddings[0]

    async def _get_ollama_embeddings(
        self,
        texts: List[str],
        base_url: str,
        model: str = "nomic-embed-text",
    ) -> List[List[float]]:
        import aiohttp

        api_url = build_ollama_url(base_url, "/api/embeddings")
        request_kwargs = get_ollama_request_kwargs()

        async with aiohttp.ClientSession() as session:
            try:
                return await self._request_ollama_embeddings(
                    session, api_url, texts, model, request_kwargs
                )
            except Exception as exc:
                error_text = str(exc).lower()
                if "not found" not in error_text and "pull" not in error_text and "404" not in error_text:
                    raise

                await self._pull_ollama_model(session, base_url, model, request_kwargs)
                return await self._request_ollama_embeddings(
                    session, api_url, texts, model, request_kwargs
                )

    async def _request_ollama_embeddings(
        self,
        session,
        api_url: str,
        texts: List[str],
        model: str,
        request_kwargs: dict,
    ) -> List[List[float]]:
        embeddings = []
        for text in texts:
            async with session.post(
                api_url,
                json={"model": model, "prompt": text},
                **request_kwargs,
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    embeddings.append(data["embedding"])
                else:
                    error_text = await resp.text()
                    raise Exception(f"Ollama embedding error: {error_text}")

        return embeddings

    async def _pull_ollama_model(
        self,
        session,
        base_url: str,
        model: str,
        request_kwargs: dict,
    ) -> None:
        pull_url = build_ollama_url(base_url, "/api/pull")

        async with session.post(
            pull_url,
            json={"model": model, "stream": False},
            **request_kwargs,
        ) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Ollama pull error: {error_text}")


embedding_service = EmbeddingService()
