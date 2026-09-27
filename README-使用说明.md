# gugu image playground

本地优先的融合版 AI 图像生成与编辑工作台（基于 gpt_image_playground + nova-image-studio）。

## 快速开始

### 首次使用
1. 双击 **INSTALL.bat** —— 自动安装依赖并构建（需 2-3 分钟，要求已安装 Node.js ≥ 20）
2. 完成后双击 **START.bat**

### 日常使用
双击 **START.bat**，选择启动开发模式，浏览器自动打开：

```text
http://localhost:5173
```

## 首次启动后必做配置

1. 右上角 **⚙ 设置** → **API 配置**：填入你的中转站地址和 API Key（模型如 `gpt-image-2.5`）
2. ⚙ 设置 → **文本模型** → 添加一个文本模型（如 `deepseek-chat`，协议选 OpenAI Chat），并设为各功能的默认模型
3. ⚙ 设置 → **Agent 配置** → 查看能力诊断；优先选择提案模式，并为其指定文本大脑和图像配置

## 内置提示词库

提示词广场内置 **2233 条**提示词（来源：awesome-gpt-image-2、ZeroLu、YouMind、ImgEdify、大香蕉收纳盒），13 个分类可筛选搜索。

预览图说明：awesome 系列的 553 张缩略图已内置（离线可用）；大香蕉来源的 1428 张预览图默认不入库（图片来自网络收集），克隆后可选运行一次补全（需 Python + Pillow）：

```bash
pip install pillow
python scripts/fetch-nb-thumbs.py
```

不运行也不影响使用，只是该部分条目不显示预览图。

## 功能入口

宽屏（≥1280px）用**左侧导航栏**；窄屏用顶部图标。

| 功能 | 说明 |
|---|---|
| 画廊 | 生成历史、收藏夹、批量下载 |
| Agent | 对话式改图、提案确认、版本历史与版本切换（兼容任意中转） |
| 反推提示词 | 上传参考图，AI 反推提示词（支持风格提取/高保真复刻） |
| 无限画布 | 多图迭代编排，连线生成 |
| GIF 生成 | 一句话生成 12 帧动画，导出 GIF |
| 提示词库 | 内置灵感广场 + 个人素材 |

### 支持的图像 API 协议
- OpenAI 兼容（Images API / Responses API）
- Gemini 直连（generateContent）
- Grok Imagine 直连
- sub2api（异步）、fal.ai、自定义 HTTP

### 支持的文本模型协议
OpenAI Responses / OpenAI Chat / Anthropic Messages / Google Gemini

## 常见问题

**Q: 打开是白屏/旧界面？**
强刷：`Ctrl + Shift + R`

**Q: 数据存在哪？**
全部本地。历史在浏览器 IndexedDB。设置 → 数据管理 可导出备份。

**Q: 能力诊断显示可用，为什么真实请求仍失败？**
能力诊断只检查本地字段和协议兼容性，不会发送请求或消耗额度。模型权限、网关兼容性和上游工具开放情况需通过实际生成确认。

**Q: 端口被占用？**
开发模式改用 `npx vite --port 其他端口`。
