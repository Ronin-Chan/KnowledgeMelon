import litellm
from typing import List, Optional

class EmbeddingService:
    # 各提供商通用 OpenAI 客户端的基础地址。
    PROVIDER_BASE_URLS = {
        "openai": "https://api.openai.com/v1",
        "alibaba": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "zhipu": "https://open.bigmodel.cn/api/paas/v4",
        "moonshot": "https://api.moonshot.cn/v1",
    }

    # 提供商与原始模型名的映射。
    PROVIDER_MODELS = {
        "openai": "text-embedding-3-small",
        "alibaba": "text-embedding-v3",
        "zhipu": "embedding-3",
        "moonshot": "moonshot-embedding",
    }

    # 本地 Ollama 配置。
    OLLAMA_BASE_URL = "http://localhost:11434"
    OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"

    async def get_embeddings(
        self,
        texts: List[str],
        api_key: str,
        provider: str = "openai",
        base_url: Optional[str] = None,
        use_local: bool = False
    ) -> List[List[float]]:
        """使用直连客户端获取一组文本的 embedding，不经过 litellm。"""

        # 如果需要，就使用本地 Ollama。
        if use_local:
            return await self._get_ollama_embeddings(
                texts, self.OLLAMA_BASE_URL, self.OLLAMA_EMBEDDING_MODEL
            )

        url = base_url if base_url else self.PROVIDER_BASE_URLS.get(provider)
        model = self.PROVIDER_MODELS.get(provider, "text-embedding-3-small")

        if provider == "zhipu":
            # 智谱需要原生 SDK，因为它使用 JWT 认证。
            import asyncio
            from zhipuai import ZhipuAI
            
            # 显式清理并转换 api_key，避免残留 header 或代理前缀。
            clean_api_key = str(api_key).strip()
            # 如果用户通过某些代理逻辑传入了 "Bearer "，这里顺手去掉。
            if clean_api_key.lower().startswith("bearer "):
                clean_api_key = clean_api_key[7:].strip()
                
            if not base_url or "bigmodel.cn" in base_url:
                # 直连智谱官方接口。
                client = ZhipuAI(api_key=clean_api_key)
                resp = await asyncio.to_thread(
                    client.embeddings.create,
                    model="embedding-3", # 显式写死的回退模型。
                    input=texts
                )
                return [item.embedding for item in resp.data]
            else:
                # 本地代理场景（例如 OneAPI / OpenCode 会处理占位 key）。
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=api_key, base_url=base_url)
                resp = await client.embeddings.create(model="embedding-3", input=texts)
                return [item.embedding for item in resp.data]
        else:
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
        """获取单条文本的 embedding。"""
        embeddings = await self.get_embeddings(
            [text], api_key, provider, base_url, use_local
        )
        return embeddings[0]

    async def _get_ollama_embeddings(
        self,
        texts: List[str],
        base_url: str,
        model: str = "nomic-embed-text"
    ) -> List[List[float]]:
        """从 Ollama API 获取 embedding。"""
        import aiohttp

        # 规范化基础地址。
        if base_url.endswith('/v1'):
            api_url = base_url.replace('/v1', '/api/embeddings')
        else:
            api_url = f"{base_url.rstrip('/')}/api/embeddings"

        embeddings = []
        async with aiohttp.ClientSession() as session:
            for text in texts:
                async with session.post(
                    api_url,
                    json={"model": model, "prompt": text}
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        embeddings.append(data['embedding'])
                    else:
                        error_text = await resp.text()
                        raise Exception(f"Ollama embedding error: {error_text}")

        return embeddings

embedding_service = EmbeddingService()
