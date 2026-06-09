"""
自动提取腾讯文档装修知识库内容 - V3
修复 Playwright API 使用问题
"""

import asyncio
import re
from pathlib import Path
from typing import Dict
from playwright.async_api import async_playwright, Page
import time

# 主文档 URL
MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

# 输出目录
OUTPUT_DIR = Path("backend/data/knowledge/weixin-docs")
IMAGES_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 需要提取的文档标题列表
DOCUMENT_TITLES = [
    "一口气搞懂自装修：工人选择与工费参考",
    "一口气搞懂自装修：开工准备与交底细节",
    "一口气搞懂自装修：打拆环节",
    "一口气搞懂自装修：新建环节",
    "一口气搞懂自装修：电路环节",
]


def slugify(text: str) -> str:
    """将中文标题转换为文件名友好的格式"""
    text = re.sub(r'[^一-龥a-zA-Z0-9]+', '-', text)
    text = text.strip('-')
    return text[:50]


async def click_and_open_document(page: Page, title: str) -> bool:
    """点击文档标题打开新页面"""
    try:
        print(f"  正在查找: {title}")
        
        # 使用 click 方法直接点击
        await page.get_by_text(title, exact=True).first.click()
        print(f"  已点击")
        
        # 等待新标签页打开
        await asyncio.sleep(3)
        return True

    except Exception as e:
        print(f"  点击失败: {e}")
        return False


async def extract_document_content(page: Page, title: str, slug: str) -> Dict:
    """提取文档内容"""
    print(f"  正在提取内容...")

    try:
        # 等待页面加载
        await page.wait_for_load_state('networkidle', timeout=10000)
        await asyncio.sleep(2)

        # 获取页面标题和URL
        page_title = await page.title()
        url = page.url

        # 提取文本内容
        content = await page.evaluate('''() => {
            const textbox = document.querySelector('[role="textbox"]');
            if (textbox) {
                return textbox.innerText;
            }
            return document.body.innerText;
        }''')

        # 截图
        screenshot_file = f"{slug}-full.png"
        screenshot_path = IMAGES_DIR / screenshot_file
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"  截图已保存: {screenshot_file}")
        print(f"  文本长度: {len(content)} 字符")

        return {
            'title': page_title or title,
            'content': content,
            'screenshot': screenshot_file,
            'url': url
        }

    except Exception as e:
        print(f"  内容提取失败: {e}")
        return None


def generate_markdown(title: str, extracted_data: Dict) -> str:
    """生成 Markdown 文件"""
    if not extracted_data:
        return None

    md_content = f"""# {extracted_data['title']}

> 来源：腾讯文档 - 装修知识库
>
> 原始链接：{extracted_data['url']}

---

{extracted_data['content']}

---

## 完整页面截图

![{extracted_data['title']}](images/{extracted_data['screenshot']})

---

*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*
"""

    return md_content


async def main():
    """主函数"""
    print("=" * 60)
    print("装修知识库自动提取工具 V3")
    print("=" * 60)
    print(f"将提取 {len(DOCUMENT_TITLES)} 个文档 (测试版)")
    print("=" * 60)

    async with async_playwright() as p:
        # 启动浏览器
        print("\n启动浏览器...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # 访问主文档
            print(f"\n访问主文档...")
            await page.goto(MAIN_DOC_URL)
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(2)
            print("主文档已加载")

            # 统计
            success_count = 0
            failed_count = 0
            skipped_count = 0

            # 逐个处理文档
            for idx, doc_title in enumerate(DOCUMENT_TITLES, 1):
                print(f"\n[{idx}/{len(DOCUMENT_TITLES)}] {doc_title}")

                slug = slugify(doc_title)
                md_file = OUTPUT_DIR / f"{slug}.md"

                # 检查是否已存在
                if md_file.exists():
                    print(f"  文件已存在，跳过")
                    skipped_count += 1
                    continue

                # 点击打开文档
                clicked = await click_and_open_document(page, doc_title)

                if not clicked:
                    failed_count += 1
                    continue

                # 切换到新标签页
                pages = context.pages
                if len(pages) > 1:
                    new_page = pages[-1]

                    # 提取内容
                    extracted_data = await extract_document_content(new_page, doc_title, slug)

                    if extracted_data:
                        # 生成 Markdown
                        markdown_content = generate_markdown(doc_title, extracted_data)

                        if markdown_content:
                            # 保存文件
                            with open(md_file, 'w', encoding='utf-8') as f:
                                f.write(markdown_content)
                            print(f"  Markdown 已保存: {md_file.name}")
                            success_count += 1
                        else:
                            failed_count += 1
                    else:
                        failed_count += 1

                    # 关闭新标签页
                    await new_page.close()

                    # 切回主文档
                    await page.bring_to_front()
                    await asyncio.sleep(1)
                else:
                    print(f"  未打开新标签页")
                    failed_count += 1

            # 总结
            print("\n" + "=" * 60)
            print("提取完成！")
            print("=" * 60)
            print(f"成功: {success_count} 个文档")
            print(f"跳过: {skipped_count} 个文档")
            print(f"失败: {failed_count} 个文档")
            print(f"输出目录: {OUTPUT_DIR.absolute()}")
            print(f"图片目录: {IMAGES_DIR.absolute()}")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
