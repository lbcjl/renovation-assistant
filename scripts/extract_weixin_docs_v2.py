"""
自动提取腾讯文档装修知识库内容 - V2
使用点击方式访问文档，适配腾讯文档的动态链接

功能：
1. 访问主文档，识别所有子文档链接
2. 通过点击方式逐个访问子文档
3. 提取文本和截图
4. 生成 Markdown 格式的知识库文件
"""

import asyncio
import json
import re
from pathlib import Path
from typing import List, Dict
from playwright.async_api import async_playwright, Page
import time

# 主文档 URL
MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

# 输出目录
OUTPUT_DIR = Path("backend/data/knowledge/weixin-docs")
IMAGES_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 需要提取的文档标题列表（手动整理）
DOCUMENT_TITLES = [
    "一口气搞懂自装修：工人选择与工费参考",
    "一口气搞懂自装修：开工准备与交底细节",
    "一口气搞懂自装修：打拆环节",
    "一口气搞懂自装修：新建环节",
    "一口气搞懂自装修：电路环节",
    "一口气搞懂自装修：封窗环节",
    "一口气搞懂自装修：水路环节",
    "一口气搞懂自装修：防水环节",
    "一口气搞懂自装修：二次排水与回填环节",
    "一口气搞懂自装修：木工环节",
    "一口气搞懂自装修：瓦工环节",
    "一口气搞懂自装修：美缝环节",
    "一口气搞懂自装修：油工环节",
    "一口气搞懂自装修：瓷砖选择",
    "一口气搞懂全屋定制",
    "地暖安装全流程：从选材到施工",
    "一口气搞懂自装修：空调选购篇",
    "一口气搞懂自装修：暖通三方案对比",
    "一口气搞懂自装修：中央空调安装全流程",
    "主材是上限，辅材是下限！一口气搞懂瓦工辅材选购",
    "防水材料怎么选？看国标！选对耶斯来了它也漏不了！",
    "材料没选对，甲醛翻两倍！一口气搞懂油工材料选购",
    "植筋胶&钢筋 国标选购法！拒绝师傅墙裂推荐！",
    "辅材差了墙能好？砌墙砖砂水泥大盘点，自装人必看！",
    "冷热水管怎么选？ GBT18742+CJT258 双标对照",
    "国标电路材料购指南，自装、半包业主必看！",
    "水电改造三步核心指南（设计交底+材料选购+施工验收）",
    "吊顶施工全流程要点表",
    "瓦工施工全流程避坑指南（四步闭环）",
    "墙面装修（材料+施工+交底+验收）核心总结",
]


def slugify(text: str) -> str:
    """将中文标题转换为文件名友好的格式"""
    # 简化版：只保留中文、英文、数字，其他字符替换为短横线
    text = re.sub(r'[^一-龥a-zA-Z0-9]+', '-', text)
    text = text.strip('-')
    return text[:50]  # 限制长度


async def click_and_open_document(page: Page, title: str) -> bool:
    """点击文档标题打开新页面"""
    try:
        print(f"  正在查找: {title}")

        # 查找包含这个标题的元素
        element = await page.get_by_text(title, exact=True).first

        if not element:
            print(f"   未找到元素")
            return False

        # 等待并点击
        await element.click()
        print(f"   已点击")

        # 等待新标签页打开
        await asyncio.sleep(3)

        return True

    except Exception as e:
        print(f"   点击失败: {e}")
        return False


async def extract_document_content(page: Page, title: str, slug: str) -> Dict:
    """提取文档内容"""
    print(f"  正在提取内容...")

    try:
        # 等待页面加载
        await page.wait_for_load_state('networkidle', timeout=10000)
        await asyncio.sleep(2)

        # 获取页面标题
        page_title = await page.title()
        url = page.url

        # 提取文本内容
        content = ""
        try:
            # 使用 innerText 获取可见文本
            content = await page.evaluate('''() => {
                const textbox = document.querySelector('[role="textbox"]');
                if (textbox) {
                    return textbox.innerText;
                }
                // 备用方案：获取body文本
                return document.body.innerText;
            }''')
        except Exception as e:
            print(f"  警告: 文本提取失败 - {e}")

        # 截图
        screenshot_file = f"{slug}-full.png"
        screenshot_path = IMAGES_DIR / screenshot_file
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"   截图已保存: {screenshot_file}")
        except Exception as e:
            print(f"  警告: 截图失败 - {e}")
            screenshot_file = None

        print(f"   文本长度: {len(content)} 字符")

        return {
            'title': page_title or title,
            'content': content,
            'screenshot': screenshot_file,
            'url': url
        }

    except Exception as e:
        print(f"   内容提取失败: {e}")
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

"""

    # 添加截图
    if extracted_data['screenshot']:
        md_content += f"\n## 完整页面截图\n\n![{extracted_data['title']}](images/{extracted_data['screenshot']})\n\n"

    md_content += f"---\n\n*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"

    return md_content


async def main():
    """主函数"""
    print("=" * 60)
    print("装修知识库自动提取工具 V2")
    print("=" * 60)
    print(f"将提取 {len(DOCUMENT_TITLES)} 个文档")
    print("=" * 60)

    async with async_playwright() as p:
        # 启动浏览器
        print("\n启动浏览器...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # 访问主文档
            print(f"\n访问主文档: {MAIN_DOC_URL}")
            await page.goto(MAIN_DOC_URL)
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(2)
            print(" 主文档已加载")

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
                    print(f"   文件已存在，跳过")
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
                    new_page = pages[-1]  # 最后一个页面

                    # 提取内容
                    extracted_data = await extract_document_content(new_page, doc_title, slug)

                    if extracted_data:
                        # 生成 Markdown
                        markdown_content = generate_markdown(doc_title, extracted_data)

                        if markdown_content:
                            # 保存文件
                            with open(md_file, 'w', encoding='utf-8') as f:
                                f.write(markdown_content)
                            print(f"   Markdown 已保存: {md_file.name}")
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
                    print(f"   未打开新标签页")
                    failed_count += 1

            # 总结
            print("\n" + "=" * 60)
            print("提取完成！")
            print("=" * 60)
            print(f" 成功: {success_count} 个文档")
            print(f" 跳过: {skipped_count} 个文档（已存在）")
            print(f" 失败: {failed_count} 个文档")
            print(f" 输出目录: {OUTPUT_DIR.absolute()}")
            print(f"  图片目录: {IMAGES_DIR.absolute()}")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
