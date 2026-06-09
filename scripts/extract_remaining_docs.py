"""
提取剩余的12个文档
"""

import asyncio
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

# 剩余的12个文档
DOCUMENT_TITLES = [
    "思维导图合集",
    "全屋定制需求表",
    "全屋定制饰面不会选？四种工艺横向对比优缺点分析，拒绝踩坑！",
    "全屋定制避坑!七种基材怎么选柜体、柜门怎么搭配最合理",
    "全屋定制板材三大主流环保标准对比表（环保篇）",
    "全屋定制封边工艺终极实测对比表",
    "全屋定制合集",
    "家装5大施工步骤 主材+辅材精准区分文档",
    "主材入场规划表",
    "施工进度表",
    "吊顶问题安全频发：轻钢龙骨"偷工减料"成行业潜规则？",
    "一口气搞懂自装修：工人选择与工费参考",
]

def slugify(text: str) -> str:
    text = re.sub(r'[^一-龥a-zA-Z0-9]+', '-', text)
    text = text.strip('-')
    return text[:50]

async def click_and_open_document(page: Page, title: str, max_retries: int = 3) -> bool:
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"  Retry {attempt}/{max_retries}...")

            try:
                await page.get_by_text(title, exact=True).first.click(timeout=15000)
            except:
                await page.get_by_text(title).first.click(timeout=15000)

            print(f"  Clicked")
            await asyncio.sleep(5)
            return True
        except PlaywrightTimeoutError:
            print(f"  Click timeout (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            continue
        except Exception as e:
            print(f"  Click failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            continue
    return False

async def extract_document_content(page: Page, title: str, slug: str) -> Optional[Dict]:
    print(f"  Extracting content...")
    try:
        try:
            await page.wait_for_load_state('networkidle', timeout=30000)
        except PlaywrightTimeoutError:
            print(f"  Warning: networkidle timeout, continuing...")

        await asyncio.sleep(5)
        page_title = await page.title()
        url = page.url

        content = ""
        try:
            content = await page.evaluate('() => { const textbox = document.querySelector("[role=textbox]"); if (textbox) { return textbox.innerText; } return null; }')
        except Exception as e:
            print(f"  Method 1 failed: {e}")

        if not content:
            try:
                content = await page.evaluate('() => { const selectors = [".doc-content", ".document-content", "[class*=content]", "main", "article"]; for (const selector of selectors) { const el = document.querySelector(selector); if (el && el.innerText && el.innerText.length > 100) { return el.innerText; } } return document.body.innerText; }')
            except Exception as e:
                print(f"  Method 2 failed: {e}")

        if not content or len(content.strip()) < 50:
            print(f"  Warning: text content is empty or too short ({len(content) if content else 0} chars)")
            content = content or ""

        screenshot_file = f"{slug}-full.png"
        screenshot_path = IMAGES_DIR / screenshot_file
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True, timeout=30000)
            print(f"  Screenshot saved: {screenshot_file}")
        except Exception as e:
            print(f"  Warning: screenshot failed - {e}")
            screenshot_file = None

        print(f"  Text length: {len(content)} chars")

        return {
            'title': page_title or title,
            'content': content,
            'screenshot': screenshot_file,
            'url': url
        }
    except Exception as e:
        print(f"  Content extraction failed: {e}")
        return None

def generate_markdown(title: str, extracted_data: Dict) -> str:
    if not extracted_data:
        return None

    md_content = f"""# {extracted_data['title']}

> 来源：腾讯文档 - 装修知识库
>
> 原始链接：{extracted_data['url']}

---

## 正文内容

{extracted_data['content'] if extracted_data['content'] else '(文本内容提取失败，请查看下方截图)'}

---

"""

    if extracted_data['screenshot']:
        md_content += f"""## 完整页面截图

![{extracted_data['title']}](images/{extracted_data['screenshot']})

---

"""

    md_content += f"*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"
    return md_content

async def main():
    print("=" * 60)
    print("Extract remaining 12 documents")
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

            success_count = 0
            failed_count = 0
            skipped_count = 0

            for idx, doc_title in enumerate(DOCUMENT_TITLES, 1):
                print(f"\n[{idx}/{len(DOCUMENT_TITLES)}] {doc_title}")

                slug = slugify(doc_title)
                md_file = OUTPUT_DIR / f"{slug}.md"

                if md_file.exists():
                    print(f"  File exists, skipping")
                    skipped_count += 1
                    continue

                clicked = await click_and_open_document(page, doc_title, max_retries=3)

                if not clicked:
                    print(f"  Failed: unable to click link")
                    failed_count += 1
                    continue

                pages = context.pages
                if len(pages) > 1:
                    new_page = pages[-1]
                    extracted_data = await extract_document_content(new_page, doc_title, slug)

                    if extracted_data and (extracted_data['content'] or extracted_data['screenshot']):
                        markdown_content = generate_markdown(doc_title, extracted_data)
                        if markdown_content:
                            with open(md_file, 'w', encoding='utf-8') as f:
                                f.write(markdown_content)
                            print(f"  Success: Markdown saved")
                            success_count += 1
                        else:
                            print(f"  Failed: Markdown generation failed")
                            failed_count += 1
                    else:
                        print(f"  Failed: content and screenshot both failed")
                        failed_count += 1

                    try:
                        await new_page.close()
                    except:
                        pass

                    await page.bring_to_front()
                    await asyncio.sleep(2)
                else:
                    print(f"  Failed: no new tab opened")
                    failed_count += 1

                if idx < len(DOCUMENT_TITLES):
                    await asyncio.sleep(2)

            print("\n" + "=" * 60)
            print("Extraction complete!")
            print("=" * 60)
            print(f"Success: {success_count} docs")
            print(f"Skipped: {skipped_count} docs (already exist)")
            print(f"Failed: {failed_count} docs")
            print(f"Total: {success_count + skipped_count + failed_count}/{len(DOCUMENT_TITLES)}")
            print(f"")
            print(f"Output dir: {OUTPUT_DIR.absolute()}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
