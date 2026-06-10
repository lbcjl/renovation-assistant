# 腾讯文档知识库提取脚本

## 功能

自动从腾讯文档提取装修知识库内容，包括：
- 提取所有子文档链接
- 逐个访问并提取文本内容
- 保存完整页面截图
- 提取页面中的图片链接
- 生成 Markdown 格式的知识库文件

## 安装依赖

```bash
pip install playwright
python -m playwright install chromium
```

## 使用方法

```bash
cd scripts
python extract_weixin_docs.py
```

## 输出结构

```
data/knowledge/
├── extracted_links.json          # 所有文档链接列表
├── 一口气搞懂自装修-工人选择与工费参考.md
├── 一口气搞懂自装修-开工准备与交底细节.md
├── ...
└── images/                       # 截图目录
    ├── 一口气搞懂自装修-工人选择与工费参考-full.png
    ├── 一口气搞懂自装修-开工准备与交底细节-full.png
    └── ...
```

## 注意事项

1. 脚本运行时会打开浏览器窗口（headless=False），可以看到实时进度
2. 每个文档处理完后会暂停 1 秒，避免请求过快
3. 提取的内容会保存为 UTF-8 编码的 Markdown 文件
4. 图片目前仅保存完整页面截图，独立图片只记录 URL

## 提取完成后

1. 检查生成的 Markdown 文件
2. 在知识库目录补充来源说明
3. 运行 RAG 索引构建（仓库根目录）：
   ```bash
   npm run ingest
   ```
4. 重启 `npm run dev`，新知识库即可生效
