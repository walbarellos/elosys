"""Thin DeepSeek chat client (OpenAI-compatible API)."""

from __future__ import annotations

import json
import os

from curl_cffi import requests

API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"


class DeepSeekError(RuntimeError):
    pass


def get_api_key() -> str | None:
    return os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY")


def get_api_url() -> str:
    custom = os.environ.get("DEEPSEEK_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or os.environ.get("LLM_BASE_URL")
    if custom:
        return custom.rstrip("/") + ("/chat/completions" if not custom.endswith("/chat/completions") else "")
    if os.environ.get("OPENAI_API_KEY") and not os.environ.get("DEEPSEEK_API_KEY"):
        return "https://api.openai.com/v1/chat/completions"
    return API_URL


def has_key() -> bool:
    return bool(get_api_key())


def chat_json(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    timeout: int = 120,
) -> dict:
    key = get_api_key()
    if not key:
        raise DeepSeekError(
            "DEEPSEEK_API_KEY (ou OPENAI_API_KEY) não definida no ambiente"
        )
    api_url = get_api_url()
    effective_model = model
    if "api.openai.com" in api_url and model == DEFAULT_MODEL:
        effective_model = "gpt-4o-mini"

    try:
        r = requests.post(
            api_url,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": effective_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": temperature,
                "stream": False,
            },
            timeout=timeout,
        )
    except Exception as e:  # noqa: BLE001
        raise DeepSeekError(f"falha de rede: {e}") from e

    if r.status_code != 200:
        raise DeepSeekError(f"HTTP {r.status_code}: {r.text[:400]}")

    try:
        body = r.json()
        content = body["choices"][0]["message"]["content"]
        usage = body.get("usage") or {}
    except (KeyError, IndexError, ValueError) as e:
        raise DeepSeekError(f"resposta inesperada da API: {r.text[:400]}") from e

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise DeepSeekError(f"modelo não devolveu JSON válido: {content[:400]}") from e

    return {
        "data": data,
        "raw": content,
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
    }
