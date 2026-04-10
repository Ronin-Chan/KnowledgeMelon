"""
Agent 工具服务 - 为 LLM 代理提供可用工具。
包含：联网搜索、计算器、日期时间等。
"""

import json
import re
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime
from urllib.parse import quote_plus
import asyncio


class Tool:
    """工具定义。"""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Callable[..., Any]
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func

    def to_dict(self) -> Dict[str, Any]:
        """转换为 OpenAI function calling 格式。"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }


class ToolsService:
    """管理和执行工具的服务。"""

    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        """注册默认工具。"""
        self.register_tool(
            name="get_current_datetime",
            description="Get the current date and time",
            parameters={
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "时区（例如 'UTC'、'Asia/Shanghai'），默认使用本地时间。"
                    }
                },
                "required": []
            },
            func=self._get_current_datetime
        )

        self.register_tool(
            name="calculator",
            description="执行数学计算",
            parameters={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "要计算的数学表达式（例如 '2 + 2'、'sin(30)'、'sqrt(16)'）"
                    }
                },
                "required": ["expression"]
            },
            func=self._calculator
        )

        self.register_tool(
            name="web_search",
            description="在网上搜索信息",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "返回结果数量（1-10）",
                        "default": 5
                    }
                },
                "required": ["query"]
            },
            func=self._web_search
        )

    def register_tool(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Callable[..., Any]
    ):
        """注册一个新工具。"""
        self.tools[name] = Tool(name, description, parameters, func)

    def get_tools(self) -> List[Dict[str, Any]]:
        """以 OpenAI 格式获取所有工具。"""
        return [tool.to_dict() for tool in self.tools.values()]

    def get_tool(self, name: str) -> Optional[Tool]:
        """获取指定工具。"""
        return self.tools.get(name)

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """使用给定参数执行工具。"""
        tool = self.tools.get(name)
        if not tool:
            return f"Error: Tool '{name}' not found"

        try:
            result = await tool.func(**arguments) if asyncio.iscoroutinefunction(tool.func) else tool.func(**arguments)
            return json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else str(result)
        except Exception as e:
            return f"Error executing tool '{name}': {str(e)}"

    # 工具实现。
    def _get_current_datetime(self, timezone: str = None) -> Dict[str, Any]:
        """获取当前日期时间。"""
        now = datetime.now()
        return {
            "datetime": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timezone": timezone or "local"
        }

    def _calculator(self, expression: str) -> Dict[str, Any]:
        """安全计算器，只允许基础数学运算。"""
        # 允许字符白名单。
        allowed_pattern = r'^[\d\+\-\*\/\(\)\.\s\^sinocstalgrpeq]+$'
        if not re.match(allowed_pattern, expression.lower()):
            return {"error": "Invalid characters in expression"}

        try:
            # 将 ^ 替换为 **，表示幂运算。
            expr = expression.replace('^', '**')

            # 基础数学函数。
            safe_dict = {
                'sqrt': lambda x: x ** 0.5,
                'sin': lambda x: __import__('math').sin(x),
                'cos': lambda x: __import__('math').cos(x),
                'tan': lambda x: __import__('math').tan(x),
                'log': lambda x: __import__('math').log(x),
                'log10': lambda x: __import__('math').log10(x),
                'exp': lambda x: __import__('math').exp(x),
                'abs': abs,
                'round': round,
                'pi': __import__('math').pi,
                'e': __import__('math').e,
            }

            result = eval(expr, {"__builtins__": {}}, safe_dict)
            return {
                "expression": expression,
                "result": result
            }
        except Exception as e:
            return {"error": f"计算错误: {str(e)}"}

    async def _web_search(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """使用 DuckDuckGo 进行网页搜索。"""
        try:
            # 使用 DuckDuckGo 的 HTML 搜索接口（不需要 API key）。
            import aiohttp

            search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    search_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        html = await response.text()

                        # 解析结果。
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(html, 'html.parser')
                        results = []

                        for result in soup.find_all('div', class_='result')[:num_results]:
                            title_elem = result.find('a', class_='result__a')
                            snippet_elem = result.find('a', class_='result__snippet')

                            if title_elem and snippet_elem:
                                results.append({
                                    "title": title_elem.get_text(strip=True),
                                    "url": title_elem.get('href', ''),
                                    "snippet": snippet_elem.get_text(strip=True)
                                })

                        return {
                            "query": query,
                            "results": results
                        }
                    else:
                        return {"error": f"Search failed with status {response.status}"}

        except ImportError:
            return {"error": "Web search requires 'aiohttp' and 'beautifulsoup4' packages"}
        except Exception as e:
            return {"error": f"Search error: {str(e)}"}


# 全局实例。
tools_service = ToolsService()
