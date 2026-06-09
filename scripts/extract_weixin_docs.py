"""
自动提取腾讯文档装修知识库内容

功能：
1. 访问主文档，获取所有子文档链接
2. 逐个访问子文档，提取文本和图片
3. 生成 Markdown 格式的知识库文件
4. 保存图片到指定目录
"""

import asyncio
import json
import re
from pathlib import Path
from typing import List, Dict
from playwright.async_api import async_playwright, Page, Browser
import time

# 主文档 URL
MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

# 输出目录
OUTPUT_DIR = Path("backend/data/knowledge")
IMAGES_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 文档链接映射（从主文档提取）
DOCUMENT_LINKS = []


def slugify(text: str) -> str:
    """将中文标题转换为文件名友好的格式"""
    # 移除特殊字符，保留中文、英文、数字
    text = re.sub(r'[^\w\s\-]', '', text)
    text = re.sub(r'[\s]+', '-', text)
    return text.lower()


async def extract_links_from_main_doc(page: Page) -> List[Dict[str, str]]:
    """从主文档中提取所有子文档链接"""
    print("正在访问主文档...")
    await page.goto(MAIN_DOC_URL)
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)

    # 获取所有可点击的文档链接
    links = []

    # 查找所有包含文档链接的元素
    link_elements = await page.query_selector_all('a[href*="doc.weixin.qq.com"]')

    for element in link_elements:
        try:
            title = await element.inner_text()
            href = await element.get_attribute('href')

            # 过滤掉空标题和重复链接
            if title and href and href != MAIN_DOC_URL:
                # 确保是完整 URL
                if not href.startswith('http'):
                    href = 'https://doc.weixin.qq.com' + href

                links.append({
                    'title': title.strip(),
                    'url': href,
                    'slug': slugify(title.strip())
                })
        except Exception as e:
            print(f"提取链接时出错: {e}")
            continue

    # 去重
    seen_urls = set()
    unique_links = []
    for link in links:
        if link['url'] not in seen_urls:
            seen_urls.add(link['url'])
            unique_links.append(link)

    print(f"找到 {len(unique_links)} 个子文档链接")
    return unique_links


async def extract_document_content(page: Page, doc_info: Dict[str, str]) -> Dict:
    """提取单个文档的内容"""
    print(f"\n正在处理: {doc_info['title']}")

    try:
        # 访问文档
        await page.goto(doc_info['url'])
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)

        # 获取文档标题
        title = await page.title()

        # 提取文本内容 - 获取主内容区域
        content = ""
        try:
            # 查找文档主体内容区域（根据腾讯文档的 DOM 结构）
            content_element = await page.query_selector('[role="textbox"]')
            if content_element:
                content = await content_element.inner_text()
            else:
                # 备用方案：获取整个页面文本
                content = await page.evaluate('document.body.innerText')
        except Exception as e:
            print(f"  警告: 提取文本时出错 - {e}")
            content = ""

        # 截取完整页面截图
        screenshot_path = IMAGES_DIR / f"{doc_info['slug']}-full.png"
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"  ✓ 截图已保存: {screenshot_path.name}")
        except Exception as e:
            print(f"  警告: 截图失败 - {e}")
            screenshot_path = None

        # 提取页面中的图片
        images = []
        try:
            img_elements = await page.query_selector_all('img')
            for idx, img in enumerate(img_elements):
                src = await img.get_attribute('src')
                if src and src.startswith('http'):
                    images.append({
                        'index': idx,
                        'src': src
                    })
        except Exception as e:
            print(f"  警告: 提取图片列表失败 - {e}")

        print(f"  ✓ 文本长度: {len(content)} 字符")
        print(f"  ✓ 找到 {len(images)} 张图片")

        return {
            'title': title,
            'content': content,
            'screenshot': screenshot_path.name if screenshot_path else None,
            'images': images,
            'url': doc_info['url']
        }

    except Exception as e:
        print(f"  ✗ 处理文档失败: {e}")
        return None


def generate_markdown(doc_info: Dict[str, str], extracted_data: Dict) -> str:
    """生成 Markdown 格式的知识库文件"""
    if not extracted_data:
        return None

    md_content = f"""# {extracted_data['title']}

> 来源：腾讯文档 - {doc_info['title']}
>
> 原始链接：{extracted_data['url']}

---

## 正文内容

{extracted_data['content']}

---

## 附件

"""

    # 添加完整截图
    if extracted_data['screenshot']:
        md_content += f"\n### 完整页面截图\n\n![{extracted_data['title']}](images/{extracted_data['screenshot']})\n\n"

    # 添加图片列表（如果有）
    if extracted_data['images']:
        md_content += f"\n### 页面图片\n\n"
        for img in extracted_data['images']:
            md_content += f"- 图片 {img['index'] + 1}: {img['src']}\n"

    md_content += f"\n---\n\n*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"

    return md_content


async def main():
    """主函数"""
    print("=" * 60)
    print("装修知识库自动提取工具")
    print("=" * 60)

    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)  # headless=False 可以看到浏览器操作
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # 步骤 1: 提取所有文档链接
            document_links = await extract_links_from_main_doc(page)

            if not document_links:
                print("未找到任何文档链接！")
                return

            # 保存链接列表到 JSON 文件
            links_file = OUTPUT_DIR / "extracted_links.json"
            with open(links_file, 'w', encoding='utf-8') as f:
                json.dump(document_links, f, ensure_ascii=False, indent=2)
            print(f"\n链接列表已保存到: {links_file}")

            # 步骤 2: 逐个处理文档
            print("\n" + "=" * 60)
            print(f"开始处理 {len(document_links)} 个文档...")
            print("=" * 60)

            success_count = 0
            failed_count = 0

            for idx, doc_info in enumerate(document_links, 1):
                print(f"\n[{idx}/{len(document_links)}] {doc_info['title']}")

                # 提取文档内容
                extracted_data = await extract_document_content(page, doc_info)

                if extracted_data:
                    # 生成 Markdown 文件
                    markdown_content = generate_markdown(doc_info, extracted_data)

                    if markdown_content:
                        # 保存到文件
                        md_file = OUTPUT_DIR / f"{doc_info['slug']}.md"
                        with open(md_file, 'w', encoding='utf-8') as f:
                            f.write(markdown_content)

                        print(f"  ✓ Markdown 已保存: {md_file.name}")
                        success_count += 1
                    else:
                        print(f"  ✗ Markdown 生成失败")
                        failed_count += 1
                else:
                    failed_count += 1

                # 避免请求过快，休息一下
                await asyncio.sleep(1)

            # 步骤 3: 生成总结报告
            print("\n" + "=" * 60)
            print("提取完成！")
            print("=" * 60)
            print(f"✓ 成功: {success_count} 个文档")
            print(f"✗ 失败: {failed_count} 个文档")
            print(f"📁 输出目录: {OUTPUT_DIR.absolute()}")
            print(f"🖼️  图片目录: {IMAGES_DIR.absolute()}")

            # 生成 sources.md 更新
            print("\n提示: 请更新 backend/data/sources.md 文件，添加这些新文档的来源说明。")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
