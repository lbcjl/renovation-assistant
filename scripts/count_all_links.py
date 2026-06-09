"""统计主文档中所有的链接"""
import asyncio
from playwright.async_api import async_playwright

MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        print("正在访问主文档...")
        await page.goto(MAIN_DOC_URL)
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(5)
        
        # 提取所有包含"一口气"或"装修"的文本元素
        links = await page.evaluate('''() => {
            const results = [];
            const seen = new Set();
            
            // 查找所有可能的链接文本
            const elements = document.querySelectorAll('*');
            
            for (const el of elements) {
                const text = el.textContent?.trim();
                if (text && text.length > 5 && text.length < 150) {
                    // 包含关键词
                    if (text.includes('一口气') || 
                        text.includes('装修') || 
                        text.includes('选购') ||
                        text.includes('施工') ||
                        text.includes('材料') ||
                        text.includes('环节')) {
                        
                        // 避免重复
                        if (!seen.has(text)) {
                            // 检查是否看起来像可点击的
                            const style = window.getComputedStyle(el);
                            if (style.cursor === 'pointer' || el.tagName === 'A') {
                                seen.add(text);
                                results.push(text);
                            }
                        }
                    }
                }
            }
            
            return results;
        }''')
        
        print(f"\n找到 {len(links)} 个可能的链接:")
        print("=" * 60)
        for i, link in enumerate(links, 1):
            print(f"{i}. {link}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
