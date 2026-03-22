# Prompt 编写规范

## 核心原则

每个 Prompt 必须 300-500 英文词，包含完整的视觉描述和中文文案。

## Prompt 结构模板

```
3:4 vertical Xiaohongshu [card type: cover/content/summary].

**Style**: [Visual style] with [key characteristics].

**Background**: 
[Color description with HEX codes]
[Texture, gradient, or pattern details]
[Lighting and atmosphere]

**Main Subject/Layout**:
[Main visual elements description]
[Position and composition]
[Size ratios and proportions]

**Decorative Elements**:
[Icons, shapes, illustrations]
[Position and style]

**Text Content** (Chinese):
[Exact text to appear - titles, subtitles, body text, labels]

**Typography**:
- Title: [Font style], [size], [color HEX], [position]
- Body: [Font style], [size], [color HEX], [line height]
- Emphasis: [Highlight strategy with colors]

**Negative prompts**: [15-25 items separated by commas]
```

## 示例：封面图

```
3:4 vertical Xiaohongshu cover image. Fresh natural style with warm, soft tones.

**Background**: 
Pure cream white (#FAF9F7) as base. Soft natural light glow from upper left corner. Clean, airy feel with generous white space.

**Main Subject**:
A female hand holding a smartphone, positioned center-lower. Phone slightly tilted, screen showing blurred viewfinder. Hand occupies 40% of frame height.

**Decorative Elements**:
2-3 polaroid-style photos floating around phone. Minimal sparkles (✨) in pale gold near title. Small mint camera icon in corner.

**Text Content** (Chinese):
Title line 1: "废片退退退！✨"
Title line 2: "6秒拍出氛围感神图"
Corner tag: "拍照技巧"

**Typography**:
- Title: Upper 1/4, left-aligned, rounded sans-serif bold, deep gray-brown (#3D3832)
- Line 2: 70% size of line 1, same color
- Corner tag: Pill background mint green (#B8E0D2), small text

**Negative prompts**: dark background, neon colors, high saturation, cyberpunk, cold blue tones, cluttered, multiple fonts, blurry, low quality, text overflow
```

## 示例：内容图（要点列表）

```
3:4 vertical Xiaohongshu content card. Clean hierarchy for key points.

**Background**: 
Cream white (#FAF9F7) base. Minimal, no distractions.

**Main Subject/Layout**:
Top 15%: Title area
Main section: Three content blocks vertically arranged with 24px gaps.

**Decorative Elements**:
Circular number badges: mint green (#B8E0D2) circles with white numbers.

**Text Content** (Chinese):
Title: "✨ 6秒出片 记住这3点"

Point 1: "❶ 光线是灵魂 / 找窗边 / 找阴影 / 找逆光"
Point 2: "❷ 少即是多 / 画面只留1个主体"
Point 3: "❸ 角度决定气质 / 低角度显腿长 / 平视最自然"

**Typography**:
- Title: Top left, bold, large, #3D3832
- Point headers: Bold, medium, #3D3832
- Details: Regular, smaller, #666666
- Numbers highlighted in #5ABAB7

**Negative prompts**: information overload, tiny text, no hierarchy, cramped, more than 3 colors, walls of text, complex backgrounds
```

## 通用负面词库

**色彩**：dark background, neon colors, fluorescent, high saturation, cyberpunk, cold blue tones, garish colors

**风格**：tech/digital style, corporate look, stock photo, over-designed, cluttered, heavy filters, 3D render, cartoon, anime

**排版**：tiny text, text overflow, multiple fonts, walls of text, no white space, cramped, misaligned

**质量**：blurry, low quality, pixelated, watermarks, artifacts, noise
