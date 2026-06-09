"""
自动提取腾讯文档装修知识库内容 - V5 完整版
包含所有 41 个文档
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

# 完整的41个文档标题列表
DOCUMENT_TITLES = [
    # 施工流程篇（19个）
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

    # 辅材选购篇（8个）
    "主材是上限，辅材是下限！一口气搞懂瓦工辅材选购",
    "防水材料怎么选？看国标！选对耶斯来了它也漏不了！",
    "材料没选对，甲醛翻两倍！一口气搞懂油工材料选购",
    "植筋胶&钢筋 国标选购法！拒绝师傅墙裂推荐！",
    "辅材差了墙能好？砌墙砖砂水泥大盘点，自装人必看！",
    "冷热水管怎么选？ GBT18742+CJT258 双标对照",
    "国标电路材料购指南，自装、半包业主必看！",
    "吊顶问题安全频发：轻钢龙骨"偷工减料"成行业潜规则？",
