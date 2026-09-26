<div align="center">

# Nova Image Studio

**融合版 AI 图像生成与编辑工作台**

基于 [gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) 与 [nova-image-studio](https://github.com/tianjiangqiji/nova-image-studio) 融合二次开发

</div>

---

## 📖 简介

Nova Image Studio 是一个面向个人使用的 AI 图像生成工作台。纯前端架构（浏览器直连 API，数据全本地），支持多协议图像与文本模型，内置提示词广场（2200+ 条带预览图）、反推提示词、无限画布、GIF 生成、提案式 Agent 等功能。

## ✨ 功能特性

### 🎨 图像生成与编辑
- 文生图 / 图生图，最多 16 张参考图（支持剪贴板与拖拽）
- 可视化遮罩编辑器，自动预处理符合官方分辨率限制
- 透明背景双模式：API 原生 / 本地绿幕抠图后处理
- 流式生成预览，缓解连接超时
- 提示词防改写 + 实际参数对比（可查看模型改写后的提示词）

### 🤖 Agent 模式
- 提案模式：任意协议的文本模型当大脑分析意图 → 生成生图提案 → 用户确认后出图（**兼容不支持 Responses API 的中转**）
- 原生 / 混合模式：基于 Responses API 的多轮对话式生成
- 分支与重新生成、@ 引用参考图

### 🔌 多协议支持

**图像模型：**
- OpenAI 兼容（Images API / Responses API）
- Gemini 直连（generateContent）
- Grok Imagine 直连
- sub2api（异步）、fal.ai、自定义 HTTP 供应商

**文本模型：**
- OpenAI Responses / OpenAI Chat Completions / Anthropic Messages / Google Gemini

### 📚 提示词广场
- 内置 **2200+ 条**提示词，13 个分类，**2100+ 条带本地预览图**（离线可用）
- 数据来源：awesome-gpt-image-2、ZeroLu/awesome-gpt-image、YouMind/awesome-nano-banana-pro-prompts、ImgEdify/Awesome-GPT4o-Image-Prompts、大香蕉提示词收纳盒（见仓库内来源列表）
- 搜索 / 分类筛选 / 分页 / 收藏到我的收藏
- 自定义模板添加

### 🔍 其他工具
- **反推提示词**：上传参考图，AI 反推（风格提取 / 高保真复刻两种模式），带历史记录
- **无限画布**：多图迭代编排，连线生成，空间化管理创作分支
- **GIF 生成**：一句话生成 12 帧网格动画，调帧延迟后导出 GIF
- **我的素材**：图片素材收藏库（搜索 / 排序 / 重命名 / 一键用作参考图）
- **提示词优化**：AI 润色提示词（区分文生图 / 图生图场景）

### 📁 数据与隐私
- 全部数据存浏览器 IndexedDB，不经任何第三方
- 多收藏夹管理、批量 ZIP 打包下载、一键备份恢复
- 可选 Node 服务端：任务队列 + SSE 状态推送 + 产物落盘（关浏览器任务继续跑）

## 🚀 快速开始

要求：Node.js ≥ 20

```bash
# 安装依赖
npm install

# 开发模式（http://localhost:5173）
npm run dev

# 构建生产版本（dist/）
npm run build

# 可选：服务器模式（任务队列 + 静态托管，http://localhost:8787）
npm run server
```

Windows 用户可直接双击 `START.bat`（日常启动）/ `INSTALL.bat`（首次安装）。

首次启动后：设置 → API 配置 填入你的 API 地址和 Key；设置 → 文本模型 配置文本模型（供反推/优化/Agent 使用）。

## 🙏 致谢

- [gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) (MIT) — 画廊架构、遮罩编辑、历史管理、多配置系统、本项目的基座
- [nova-image-studio](https://github.com/tianjiangqiji/nova-image-studio) (AGPL-3.0) — 多协议文本模型层、反推提示词、GIF 生成、提案式 Agent、画布与素材库的设计参考
- 提示词广场数据来源：[awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2)、[ZeroLu/awesome-gpt-image](https://github.com/ZeroLu/awesome-gpt-image)、[YouMind/awesome-nano-banana-pro-prompts](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts)、[ImgEdify/Awesome-GPT4o-Image-Prompts](https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts)、[大香蕉提示词收纳盒](https://nanobanana-website.vercel.app/)
- 预览图版权归原作者所有，仅作学习研究用途，侵删

## 📄 许可证

双许可，详见 [LICENSE](LICENSE)：
- 整体及源自 nova-image-studio 的部分：**AGPL-3.0**
- 源自 gpt_image_playground 的部分：**MIT**
- 提示词与预览图数据：版权归原作者，仅作学习研究用途
