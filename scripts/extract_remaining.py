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
]
