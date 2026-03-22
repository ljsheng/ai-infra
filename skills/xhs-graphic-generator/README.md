# 小红书图文生成器 (XHS Graphic Generator)

一个 AI Agent Skill，用于将主题或文章转化为 5-18 张精美的小红书图文卡片（3:4 竖版，2K 分辨率）。

## 功能特点

- 📝 **双模式输入**：支持主题模式（自由规划）和改写模式（提取核心）
- 🎨 **五种视觉风格**：清新自然、简约卡片、奶油治愈、知识卡片、科技简约
- 📐 **小红书标准**：3:4 竖版比例，2K 分辨率
- 🔧 **完整工作流**：从内容规划到 Prompt 生成到图片产出

## 目录结构

```
xhs-graphic-generator/
├── SKILL.md              # Agent Skill 主文件 - 定义工作流程
├── scripts/
│   └── generate.sh       # 图片生成脚本 (调用 API)
├── references/
│   ├── prompt-guide.md   # Prompt 编写规范与示例
│   ├── styles.md         # 视觉风格配色方案
│   └── content-planning.md  # 内容规划方法论
├── .env.example          # 环境变量模板
└── README.md
```

## 快速开始

### 1. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

### 2. 使用脚本生成图片

```bash
bash scripts/generate.sh "your prompt here" "3:4" "2K"
```

## API 配置说明

> ⚠️ **重要提示**：本项目目前使用的是 **[Mulerun](https://mulerun.com)** 提供的 API 接口。

### 当前配置 (Mulerun)

- API 端点：`https://api.mulerun.com/vendors/google/v1/nano-banana-pro/generation`
- 认证方式：Bearer Token
- 环境变量：`MULERUN_API_KEY`

### 使用其他 API 提供商

如果你使用的是 **官方 API** 或 **OpenRouter** 等其他服务商，需要修改 `scripts/generate.sh` 中的以下部分：

```bash
# 修改 API 端点
API_URL="https://your-api-endpoint.com/v1/generate"

# 可能需要调整请求格式
# 查看你的 API 文档，修改 curl 请求的 JSON 结构
```

**常见替代方案：**

| 提供商 | 端点格式 | 备注 |
|--------|----------|------|
| Google 官方 | `https://generativelanguage.googleapis.com/v1beta/...` | 需要 Google Cloud 账号 |
| OpenRouter | `https://openrouter.ai/api/v1/...` | 统一接口，支持多模型 |
| Replicate | `https://api.replicate.com/v1/...` | 按运行次数计费 |

## 作为 Agent Skill 使用

将此目录放入你的 Agent 的 skills 目录中，Agent 会自动识别并在以下场景触发：

- 用户请求生成"小红书图文"、"红书笔记"
- 用户说"制作小红书帖子"、"生成 XHS 图片"
- 用户提供主题/文章要求转化为小红书格式

## 风格速查

| 风格 | 主色 | 强调色 | 适用场景 |
|------|------|--------|----------|
| 清新自然 | #FAF9F7 | #B8E0D2, #5ABAB7 | 生活方式、好物分享 |
| 简约卡片 | #FFFFFF | #E8E8E8 | 教程、科普、技术 |
| 奶油治愈 | #FDF8F3 | #C4A77D | 情感类、慢生活 |
| 知识卡片 | #F5F0E8 | #8B7355 | 技术教程、深度分析 |
| 科技简约 | #1E293B | #7C3AED, #6366F1 | AI 工具、开发者内容 |

## 退出码说明

脚本执行后会返回以下退出码：

| 退出码 | 含义 |
|--------|------|
| 0 | 成功生成图片 |
| 1 | 任务创建失败（API 错误） |
| 2 | 图片生成失败 |
| 3 | 内容被安全过滤器阻止 |
| 4 | 任务超时（6分钟） |

## License

MIT License
