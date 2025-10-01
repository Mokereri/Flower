# utils/gpt_client.py
import os

# If you use OpenAI, install: pip install openai
# and uncomment below. Otherwise, adapt to your LLM provider.

from openai import OpenAI

def generate_flower_copy(flower_name: str) -> tuple[str, list[str]]:
    """
    Returns (description, ideal_uses_list)
    Keep it short and friendly; ideal uses as 3-5 bullets.
    """
    client = OpenAI(api_key=os.getenv("LLM_API_KEY"))

    prompt = f"""
You are writing a concise, friendly weekly email for subscribers about a flower.
Flower name: "{flower_name}"

Write:
1) A short 3-4 sentence description (tone: warm, helpful; no fluff).
2) 3–5 bullet points of ideal uses (weddings, bouquets, table centerpieces, gifting, decor, symbolism, etc.).

Only return JSON with keys: description, uses (array of strings).
"""
    resp = client.chat.completions.create(
        model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        messages=[{"role":"user","content":prompt}],
        temperature=0.7
    )

    import json
    text = resp.choices[0].message.content
    try:
        data = json.loads(text)
        description = data.get("description","A beautiful flower.")
        uses = data.get("uses", ["Bouquets", "Weddings", "Home decor"])
    except Exception:
        description = text.strip()
        uses = ["Bouquets", "Weddings", "Home decor"]

    return description, uses
