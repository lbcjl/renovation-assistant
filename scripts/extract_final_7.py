"""
Extract remaining 7 documents using JSON config
"""

import asyncio
import json
import re
from pathlib import Path
from typing import Dict, Optional
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError
import time

MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

OUTPUT_DIR = Path("backend/data/knowledge/weixin-docs")
IMAGES_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Load titles from JSON config
with open("scripts/failed_docs.json", "r", encoding="utf-8") as f:
    config = json.load(f)
    DOCUMENT_TITLES = config["documents"]

def slugify(text: str) -> str:
    text = re.sub(r'[^一-龥a-zA-Z0-9]+', '-', text)
    text = text.strip('-')
    return text[:50]

async def click_and_open_document(page: Page, title: str, max_retries: int = 5) -> bool:
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"  Retry {attempt}/{max_retries}...")
                # 等待更长时间再重试
                await asyncio.sleep(5)

            # 尝试多种查找方式
            try:
                # 方法1：精确匹配
                await page.get_by_text(title, exact=True).first.click(timeout=20000)
            except:
                try:
                    # 方法2：部分匹配
                    await page.get_by_text(title).first.click(timeout=20000)
                except:
                    # 方法3：使用标题的前几个字匹配
                    short_title = title[:15]
                    await page.get_by_text(short_title).first.click(timeout=20000)

            print(f"  Clicked")
            await asyncio.sleep(8)  # 等待更长时间
            return True
        except PlaywrightTimeoutError:
            print(f"  Click timeout (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)
            continue
        except Exception as e:
            print(f"  Click failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)
            continue
    return False

async def extract_document_content(page: Page, title: str, slug: str) -> Optional[Dict]:
    print(f"  Extracting content...")
    try:
        try:
            await page.wait_for_load_state('networkidle', timeout=30000)
        except PlaywrightTimeoutError:
            print(f"  Warning: networkidle timeout")

        await asyncio.sleep(5)
        page_title = await page.title()
        url = page.url

        content = ""
        try:
            content = await page.evaluate('() => { const tb = document.querySelector("[role=textbox]"); return tb ? tb.innerText : null; }')
        except:
            pass

        if not content:
            try:
                content = await page.evaluate('() => { const s = [".doc-content", "[class*=content]", "main"]; for (const sel of s) { const e = document.querySelector(sel); if (e && e.innerText.length > 100) return e.innerText; } return document.body.innerText; }')
            except:
                pass

        screenshot_file = f"{slug}-full.png"
        screenshot_path = IMAGES_DIR / screenshot_file
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True, timeout=30000)
            print(f"  Screenshot saved: {screenshot_file}")
        except:
            screenshot_file = None

        print(f"  Text length: {len(content)} chars")

        return {'title': page_title or title, 'content': content, 'screenshot': screenshot_file, 'url': url}
    except Exception as e:
        print(f"  Extraction failed: {e}")
        return None

def generate_markdown(title: str, extracted_data: Dict) -> str:
    if not extracted_data:
        return None

    md = f"""# {extracted_data['title']}

> 来源：腾讯文档 - 装修知识库
>
> 原始链接：{extracted_data['url']}

---

## 正文内容

{extracted_data['content'] if extracted_data['content'] else '(文本内容提取失败，请查看下方截图)'}

---

"""

    if extracted_data['screenshot']:
        md += f"""## 完整页面截图

![{extracted_data['title']}](images/{extracted_data['screenshot']})

---

"""

    md += f"*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"
    return md

async def main():
    print("=" * 60)
    print(f"Extract remaining {len(DOCUMENT_TITLES)} documents")
    print("=" * 60)

    async with async_playwright() as p:
        print("\nStarting browser...")
        browser = await p.chromium.launch(headless=False, slow_mo=100)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        try:
            print(f"\nNavigating to main doc...")
            await page.goto(MAIN_DOC_URL, wait_until='networkidle', timeout=60000)
            await asyncio.sleep(5)
            print("Main doc loaded")

            success = 0
            failed = 0
            skipped = 0

            for idx, doc_title in enumerate(DOCUMENT_TITLES, 1):
                print(f"\n[{idx}/{len(DOCUMENT_TITLES)}] {doc_title}")

                slug = slugify(doc_title)
                md_file = OUTPUT_DIR / f"{slug}.md"

                if md_file.exists():
                    print(f"  File exists, skipping")
                    skipped += 1
                    continue

                clicked = await click_and_open_document(page, doc_title, max_retries=3)

                if not clicked:
                    print(f"  Failed: cannot click link")
                    failed += 1
                    continue

                pages = context.pages
                if len(pages) > 1:
                    new_page = pages[-1]
                    extracted = await extract_document_content(new_page, doc_title, slug)

                    if extracted and (extracted['content'] or extracted['screenshot']):
                        md = generate_markdown(doc_title, extracted)
                        if md:
                            with open(md_file, 'w', encoding='utf-8') as f:
                                f.write(md)
                            print(f"  Success!")
                            success += 1
                        else:
                            failed += 1
                    else:
                        failed += 1

                    try:
                        await new_page.close()
                    except:
                        pass

                    await page.bring_to_front()
                    await asyncio.sleep(2)
                else:
                    print(f"  Failed: no new tab")
                    failed += 1

            print("\n" + "=" * 60)
            print("Extraction complete!")
            print("=" * 60)
            print(f"Success: {success}")
            print(f"Skipped: {skipped}")
            print(f"Failed: {failed}")
            print(f"Total: {success + skipped + failed}/{len(DOCUMENT_TITLES)}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
