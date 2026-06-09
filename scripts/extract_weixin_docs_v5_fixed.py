"""
自动提取腾讯文档装修知识库内容 - V4
增强版：重试机制、更长等待时间、更好的容错
"""

import asyncio
import re
from pathlib import Path
from typing import Dict, Optional
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError
import time

# 主文档 URL
MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

# 输出目录
OUTPUT_DIR = Path("backend/data/knowledge/weixin-docs")
IMAGES_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 完整的文档标题列表
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
    text = re.sub(r'[^一-龥a-zA-Z0-9]+', '-', text)
    text = text.strip('-')
    return text[:50]


async def click_and_open_document(page: Page, title: str, max_retries: int = 3) -> bool:
    """点击文档标题打开新页面，支持重试"""
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"  重试 {attempt}/{max_retries}...")

            # 使用更灵活的选择器
            # 先尝试精确匹配
            try:
                await page.get_by_text(title, exact=True).first.click(timeout=15000)
            except:
                # 如果精确匹配失败，尝试部分匹配
                await page.get_by_text(title).first.click(timeout=15000)

            print(f"  已点击")

            # 等待新标签页打开，增加等待时间
            await asyncio.sleep(5)
            return True

        except PlaywrightTimeoutError:
            print(f"  点击超时 (尝试 {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            continue
        except Exception as e:
            print(f"  点击失败: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            continue

    return False


async def extract_document_content(page: Page, title: str, slug: str) -> Optional[Dict]:
    """提取文档内容，增强容错"""
    print(f"  正在提取内容...")

    try:
        # 等待页面加载，增加超时时间
        try:
            await page.wait_for_load_state('networkidle', timeout=30000)
        except PlaywrightTimeoutError:
            print(f"  警告: networkidle 超时，继续尝试...")

        # 额外等待确保内容加载
        await asyncio.sleep(5)

        # 获取页面标题和URL
        page_title = await page.title()
        url = page.url

        # 多种方式尝试提取文本内容
        content = ""

        # 方法1: 查找 role="textbox"
        try:
            content = await page.evaluate('''() => {
                const textbox = document.querySelector('[role="textbox"]');
                if (textbox) {
                    return textbox.innerText;
                }
                return null;
            }''')
        except Exception as e:
            print(f"  方法1失败: {e}")

        # 方法2: 如果方法1失败，尝试查找主要内容区域
        if not content:
            try:
                content = await page.evaluate('''() => {
                    // 尝试多个可能的内容选择器
                    const selectors = [
                        '.doc-content',
                        '.document-content',
                        '[class*="content"]',
                        'main',
                        'article'
                    ];

                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el && el.innerText && el.innerText.length > 100) {
                            return el.innerText;
                        }
                    }

                    // 最后备用方案：获取body文本，但过滤掉导航等
                    return document.body.innerText;
                }''')
            except Exception as e:
                print(f"  方法2失败: {e}")

        # 如果还是没有内容，至少记录警告
        if not content or len(content.strip()) < 50:
            print(f"  警告: 文本内容为空或太短 ({len(content) if content else 0} 字符)")
            content = content or ""

        # 截图
        screenshot_file = f"{slug}-full.png"
        screenshot_path = IMAGES_DIR / screenshot_file
        try:
            await page.screenshot(path=str(screenshot_path), full_page=True, timeout=30000)
            print(f"  截图已保存: {screenshot_file}")
        except Exception as e:
            print(f"  警告: 截图失败 - {e}")
            screenshot_file = None

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

## 正文内容

{extracted_data['content'] if extracted_data['content'] else '(文本内容提取失败，请查看下方截图)'}

---

"""

    # 添加截图
    if extracted_data['screenshot']:
        md_content += f"""## 完整页面截图

![{extracted_data['title']}](images/{extracted_data['screenshot']})

---

"""

    md_content += f"*提取时间: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"

    return md_content


async def main():
    """主函数"""
    print("=" * 60)
    print("装修知识库自动提取工具 V4 (增强版)")
    print("=" * 60)
    print(f"将提取 {len(DOCUMENT_TITLES)} 个文档")
    print("特性: 重试机制、长等待、多方法提取")
    print("=" * 60)

    async with async_playwright() as p:
        # 启动浏览器
        print("\n启动浏览器...")
        browser = await p.chromium.launch(
            headless=False,
            slow_mo=100  # 慢速模式，每个操作延迟100ms
        )
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()

        try:
            # 访问主文档
            print(f"\n访问主文档...")
            await page.goto(MAIN_DOC_URL, wait_until='networkidle', timeout=60000)
            await asyncio.sleep(5)
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

                # 点击打开文档（支持重试）
                clicked = await click_and_open_document(page, doc_title, max_retries=3)

                if not clicked:
                    print(f"  失败: 无法点击链接")
                    failed_count += 1
                    continue

                # 切换到新标签页
                pages = context.pages
                if len(pages) > 1:
                    new_page = pages[-1]

                    # 提取内容
                    extracted_data = await extract_document_content(new_page, doc_title, slug)

                    if extracted_data and (extracted_data['content'] or extracted_data['screenshot']):
                        # 生成 Markdown
                        markdown_content = generate_markdown(doc_title, extracted_data)

                        if markdown_content:
                            # 保存文件
                            with open(md_file, 'w', encoding='utf-8') as f:
                                f.write(markdown_content)
                            print(f"  成功: Markdown 已保存")
                            success_count += 1
                        else:
                            print(f"  失败: Markdown 生成失败")
                            failed_count += 1
                    else:
                        print(f"  失败: 内容和截图都提取失败")
                        failed_count += 1

                    # 关闭新标签页
                    try:
                        await new_page.close()
                    except:
                        pass

                    # 切回主文档
                    await page.bring_to_front()
                    await asyncio.sleep(2)
                else:
                    print(f"  失败: 未打开新标签页")
                    failed_count += 1

                # 每处理一个文档后休息，避免请求过快
                if idx < len(DOCUMENT_TITLES):
                    await asyncio.sleep(2)

            # 总结
            print("\n" + "=" * 60)
            print("提取完成！")
            print("=" * 60)
            print(f"成功: {success_count} 个文档")
            print(f"跳过: {skipped_count} 个文档 (已存在)")
            print(f"失败: {failed_count} 个文档")
            print(f"总计: {success_count + skipped_count + failed_count}/{len(DOCUMENT_TITLES)}")
            print(f"")
            print(f"输出目录: {OUTPUT_DIR.absolute()}")
            print(f"图片目录: {IMAGES_DIR.absolute()}")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
