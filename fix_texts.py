import sqlite3
import requests
from bs4 import BeautifulSoup
import time

BASE_URL = "http://kob.this.is/klingogbang/"
HEADERS = {
    "User-Agent": "KlingBangArchiveScraper/1.0 (Historical archive project)",
}

def fix_exhibition_texts():
    # Use 30s timeout to avoid locking issues with highres scraper
    conn = sqlite3.connect('kob_archive.db', timeout=30)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Find exhibitions with missing text
    cursor.execute("SELECT id, exhibition_id, title_is FROM exhibitions WHERE description_is IS NULL OR description_is = ''")
    exhibitions = cursor.fetchall()
    
    print(f"Fixing texts for {len(exhibitions)} exhibitions...")

    for ex in exhibitions:
        ex_db_id = ex['id']
        ex_id = ex['exhibition_id']
        
        # 1. Fetch Icelandic
        url_is = f"{BASE_URL}archive_view.php?id={ex_id}"
        desc_is = fetch_text(url_is)
        
        # 2. Fetch English
        url_en = f"{BASE_URL}archive_view.php?id={ex_id}&lang=en"
        desc_en = fetch_text(url_en)
        
        # Update DB
        cursor.execute("""
            UPDATE exhibitions 
            SET description_is = ?, description_en = ?
            WHERE id = ?
        """, (desc_is, desc_en, ex_db_id))
        conn.commit()
        
        print(f"  Fixed '{ex['title_is']}': IS({len(desc_is or '')}), EN({len(desc_en or '')})")
        time.sleep(0.5)

    conn.close()
    print("\nText fix complete!")

def fetch_text(url):
    try:
        resp = requests.get(url, timeout=10)
        resp.encoding = 'iso-8859-1'
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        text_cells = soup.find_all(class_='arc_view_text')
        
        parts = []
        for cell in text_cells:
            for s in cell(['script', 'style']):
                s.decompose()
                
            text = cell.get_text(separator='\n', strip=True)
            if text and text != '\xa0' and len(text) > 1:
                parts.append(text)
        
        return '\n\n'.join(parts) if parts else ""
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return ""

if __name__ == "__main__":
    fix_exhibition_texts()