"""
零依赖 Python 脚本：直接读取内置 geek_quotes.db
无需启动 HTTP 服务，本地直接调用
"""
import sqlite3
import json

def get_random_quote(db_path="portable/geek_quotes.db", category=None):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    if category:
        cursor.execute("SELECT id, content_zh, content_en, category, tags FROM quotes WHERE category = ? ORDER BY RANDOM() LIMIT 1", (category,))
    else:
        cursor.execute("SELECT id, content_zh, content_en, category, tags FROM quotes ORDER BY RANDOM() LIMIT 1")
        
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return {
        "id": row[0],
        "content_zh": row[1],
        "content_en": row[2],
        "category": row[3],
        "tags": json.loads(row[4]) if row[4] else []
    }

if __name__ == "__main__":
    quote = get_random_quote(category="ai_ml")
    print("[AI/ML 随机梗]")
    print(f"ZH: {quote['content_zh']}")
    print(f"EN: {quote['content_en']}")
