#!/bin/bash
# 小红书图片生成脚本 - Banana Pro API (Enhanced Error Handling)
# 用法: ./generate.sh "英文Prompt" [比例] [分辨率]
# 退出码: 0=成功, 1=创建失败, 2=生成失败, 3=内容被过滤, 4=超时

# 获取脚本所在目录，加载 .env 文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$SCRIPT_DIR/.env" ]] && source "$SCRIPT_DIR/.env"

PROMPT="$1"
ASPECT_RATIO="${2:-3:4}"
RESOLUTION="${3:-2K}"
API_KEY="${MULERUN_API_KEY}"
[[ -z "$API_KEY" ]] && { echo "❌ 请设置 MULERUN_API_KEY（在 .env 文件或环境变量中）"; exit 1; }
API_URL="https://api.mulerun.com/vendors/google/v1/nano-banana-pro/generation"

MAX_RETRIES=72      # 72 * 5s = 6分钟
POLL_INTERVAL=5

[[ -z "$PROMPT" ]] && { echo "❌ 请提供 Prompt"; exit 1; }

# ===== 提交任务 =====
echo "📤 提交任务..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" --arg ar "$ASPECT_RATIO" --arg res "$RESOLUTION" \
    '{prompt: $p, aspect_ratio: $ar, resolution: $res}')")

# 检查 HTTP 层面错误
if echo "$RESPONSE" | grep -qiE '"error"'; then
    if echo "$RESPONSE" | grep -qiE 'content_filter|policy_violation|content_blocked|nsfw|safety'; then
        echo "⚠️ 内容被安全过滤器阻止"
        echo "请尝试：1) 使用其他图片 2) 修改提示词避免敏感内容"
        exit 3
    fi
    echo "❌ API 错误: $RESPONSE"
    exit 1
fi

# 多种方式提取 task_id (兼容不同响应格式)
TASK_ID=$(echo "$RESPONSE" | jq -r '.task_info.id // .id // .taskId // .task.id // empty' 2>/dev/null)
[[ -z "$TASK_ID" ]] && TASK_ID=$(echo "$RESPONSE" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
[[ -z "$TASK_ID" ]] && { echo "❌ 任务创建失败: $RESPONSE"; exit 1; }

echo "✅ Task ID: $TASK_ID"
echo "📐 比例: $ASPECT_RATIO, 分辨率: $RESOLUTION"
echo -n "⏳ 生成中"

# ===== 轮询状态 =====
for i in $(seq 1 $MAX_RETRIES); do
    sleep $POLL_INTERVAL
    
    BODY=$(curl -s "$API_URL/$TASK_ID" -H "Authorization: Bearer $API_KEY")
    
    # 提取状态 (兼容 task_info.status 和 status)
    STATUS=$(echo "$BODY" | jq -r '.task_info.status // .status // "processing"' 2>/dev/null | tr '[:upper:]' '[:lower:]')
    [[ -z "$STATUS" ]] && STATUS=$(echo "$BODY" | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4 | tr '[:upper:]' '[:lower:]')
    
    case "$STATUS" in
        completed|succeeded|success|done)
            # 多种方式提取图片 URL (兼容不同响应格式)
            IMAGE_URL=$(echo "$BODY" | jq -r '.images[0] // .image_urls[0] // .output.images[0] // empty' 2>/dev/null)
            [[ -z "$IMAGE_URL" ]] && IMAGE_URL=$(echo "$BODY" | grep -oE '"images":\["[^"]+' | sed 's/"images":\["//')
            
            if [[ -n "$IMAGE_URL" ]]; then
                echo ""
                echo "✅ 完成!"
                echo "IMAGE_URL: $IMAGE_URL"
                exit 0
            else
                echo ""
                echo "⚠️ 任务完成但未返回图片 URL"
                echo "响应: $BODY"
                exit 2
            fi
            ;;
        failed|fail)
            echo ""
            # 检查是否是内容过滤错误
            if echo "$BODY" | grep -qiE 'content_filter|policy_violation|content_blocked|nsfw|safety|content'; then
                echo "⚠️ 内容被安全过滤器阻止"
                echo "请尝试：1) 使用其他图片 2) 修改提示词避免敏感内容"
                exit 3
            fi
            echo "❌ 生成失败"
            ERROR_MSG=$(echo "$BODY" | jq -r '.task_info.error // .error // empty' 2>/dev/null)
            [[ -n "$ERROR_MSG" ]] && echo "错误详情: $ERROR_MSG"
            echo "可能原因：1) 服务器繁忙 2) 模型无法生成有效输出"
            echo "请稍后重试"
            exit 2
            ;;
        *)
            echo -n "."
            ;;
    esac
done

echo ""
echo "⏰ 超时 (6分钟)"
echo "手动查询: curl -s '$API_URL/$TASK_ID' -H 'Authorization: Bearer $API_KEY'"
exit 4
