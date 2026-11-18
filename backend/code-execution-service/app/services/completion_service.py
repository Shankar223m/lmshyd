import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

class CodeCompletionService:
    def __init__(self, anthropic_key: str | None = None, openai_key: str | None = None, gemini_key: str | None = None):
        self.anthropic_key = anthropic_key or os.getenv("ANTHROPIC_API_KEY")
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")

    async def get_completion(self, language: str, prefix: str, suffix: str) -> dict[str, str]:
        # Try AI providers if available
        if self.gemini_key:
            try:
                res = await self._complete_gemini(language, prefix, suffix)
                if res:
                    return {"completion": res, "source": "gemini"}
            except Exception as e:
                logger.warning(f"Gemini completion failed: {e}")

        if self.openai_key:
            try:
                res = await self._complete_openai(language, prefix, suffix)
                if res:
                    return {"completion": res, "source": "openai"}
            except Exception as e:
                logger.warning(f"OpenAI completion failed: {e}")

        if self.anthropic_key:
            try:
                res = await self._complete_anthropic(language, prefix, suffix)
                if res:
                    return {"completion": res, "source": "anthropic"}
            except Exception as e:
                logger.warning(f"Anthropic completion failed: {e}")

        # Fallback to local heuristic contextual engine
        fallback = self._heuristic_completion(language, prefix, suffix)
        return {"completion": fallback, "source": "fallback"}

    async def _complete_gemini(self, language: str, prefix: str, suffix: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_key}"
        prompt = (
            f"You are a fast code completion AI engine for Monaco editor in an educational LMS.\n"
            f"Language: {language}\n"
            f"Given the prefix before cursor and suffix after cursor, generate ONLY the immediate continuation code to insert at cursor.\n"
            f"DO NOT include markdown fences (```). DO NOT include comments or explanations. Output ONLY the code to insert.\n\n"
            f"--- CODE BEFORE CURSOR ---\n{prefix[-1500:]}\n"
            f"--- CODE AFTER CURSOR ---\n{suffix[:500]}\n"
            f"--- COMPLETION ---"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 64}
        }
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return self._clean_completion(text)
        return ""

    async def _complete_openai(self, language: str, prefix: str, suffix: str) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.openai_key}", "Content-Type": "application/json"}
        prompt = (
            f"You are a fast code completion AI engine for Monaco editor.\n"
            f"Language: {language}\n"
            f"Generate ONLY the immediate continuation to insert at cursor.\n"
            f"Prefix:\n{prefix[-1500:]}\nSuffix:\n{suffix[:500]}"
        )
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a code completion engine. Return only the continuation code. No explanations, no markdown fences."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 64
        }
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                return self._clean_completion(text)
        return ""

    async def _complete_anthropic(self, language: str, prefix: str, suffix: str) -> str:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        prompt = (
            f"Language: {language}\n"
            f"Prefix:\n{prefix[-1500:]}\nSuffix:\n{suffix[:500]}\n"
            f"Return only the exact code completion without markdown ticks or explanations."
        )
        payload = {
            "model": "claude-3-haiku-20240307",
            "system": "You are an inline code autocompletion engine. Output only the immediate code tokens to insert at cursor.",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 64,
        }
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["content"][0]["text"]
                return self._clean_completion(text)
        return ""

    def _clean_completion(self, text: str) -> str:
        # Strip code markdown ticks if returned
        text = re.sub(r"^```[a-zA-Z0-9_-]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
        text = text.replace("```", "")
        return text

    def _heuristic_completion(self, language: str, prefix: str, suffix: str) -> str:
        lines = prefix.split("\n")
        current_line = lines[-1] if lines else ""
        stripped = current_line.strip()
        indent = current_line[:len(current_line) - len(current_line.lstrip())]

        lang = language.lower()

        # Python completions
        if "python" in lang or lang == "py":
            if stripped == "def":
                return " solve(data):\n" + indent + "    return data"
            if stripped.startswith("def ") and stripped.endswith(":"):
                return "\n" + indent + "    pass"
            if stripped == "if __name__":
                return " == '__main__':\n" + indent + "    main()"
            if stripped == "for":
                return " i in range(len(data)):"
            if stripped == "while":
                return " condition:\n" + indent + "    pass"
            if stripped == "class":
                return " Solution:\n" + indent + "    def __init__(self):\n" + indent + "        pass"
            if stripped == "print":
                return '("Hello, World!")'
            if stripped == "import":
                return " sys, math"
            if stripped.startswith("from ") and "import" not in stripped:
                return " import *"
            if stripped == "return":
                return " result"

        # JavaScript / TypeScript completions
        if any(k in lang for k in ["javascript", "typescript", "js", "ts", "node"]):
            if stripped == "console.":
                return 'log("Hello, World!");'
            if stripped == "function":
                return " solve(input) {\n" + indent + "  return input;\n" + indent + "}"
            if stripped == "const":
                return " result = [];"
            if stripped == "let":
                return " count = 0;"
            if stripped == "for":
                return " (let i = 0; i < n; i++) {\n" + indent + "  \n" + indent + "}"
            if stripped == "if":
                return " (condition) {\n" + indent + "  \n" + indent + "}"
            if stripped == "return":
                return " true;"
            if stripped.endswith("=>"):
                return " {\n" + indent + "  return;\n" + indent + "}"

        # Java completions
        if "java" in lang:
            if stripped == "System.":
                return 'out.println("Hello, World!");'
            if stripped == "public static void":
                return " main(String[] args) {\n" + indent + "    \n" + indent + "}"
            if stripped == "Scanner":
                return " in = new Scanner(System.in);"
            if stripped == "return":
                return " 0;"

        # C / C++ completions
        if any(k in lang for k in ["c", "cpp", "c++"]):
            if stripped == "printf":
                return '("Hello, World!\\n");'
            if stripped == "cout":
                return ' << "Hello, World!" << endl;'
            if stripped == "cin":
                return " >> n;"
            if stripped == "return":
                return " 0;"
            if stripped == "#include":
                return " <iostream>"

        # SQL completions
        if "sql" in lang:
            if stripped.upper() == "SELECT":
                return " * FROM users WHERE active = 1;"
            if stripped.upper() == "INSERT INTO":
                return " users (name, email) VALUES ('Student', 'student@example.com');"
            if stripped.upper() == "UPDATE":
                return " users SET active = 1 WHERE id = 1;"

        # Generic safe continuation
        return ""
