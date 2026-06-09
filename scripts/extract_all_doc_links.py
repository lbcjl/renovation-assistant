"""提取主文档中所有的文档链接 - 完整版"""
import asyncio
from playwright.async_api import async_playwright

MAIN_DOC_URL = "https://doc.weixin.qq.com/doc/w3_AVcARQbxADcCNCAU7PjaSSXeg9vrI?scode=AEAAkAegAFMt3ehnv9AVcARQbxADc"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        print("正在访问主文档...")
        await page.goto(MAIN_DOC_URL, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(5)
        
        # 截图看看页面内容
        await page.screenshot(path='scripts/main_doc_screenshot.png', full_page=True)
        print("已保存主文档截图: scripts/main_doc_screenshot.png")
        
        # 获取页面的完整文本内容
        full_text = await page.evaluate('() => document.body.innerText')
        
        # 保存完整文本
        with open('scripts/main_doc_content.txt', 'w', encoding='utf-8') as f:
            f.write(full_text)
        print("已保存主文档文本: scripts/main_doc_content.txt")
        
        # 统计包含关键词的行数
        lines = full_text.split('\n')
        doc_lines = [line.strip() for line in lines if '一口气' in line or '装修' in line and len(line.strip()) > 10]
        
        print(f"\n找到 {len(doc_lines)} 行包含关键词的文本")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
