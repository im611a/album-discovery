---
name: third-party-ui-audit
description: 在采用第三方 UI 或动效实现前审计来源、许可证、兼容性、依赖、包体积、可访问性和是否真正优于原创实现。
---

# Third-party UI audit

## 触发

- 准备采用 React Bits、Aceternity UI、Uiverse 或其他第三方组件时。

## 不触发

- 原有组件与少量 CSS/Anime.js 已能满足需求时，不为“使用数量”强行引入。

## 审计步骤

1. 记录官方来源、实际版本或源码提交、许可证及再分发限制。
2. 核验 React 19、Next.js App Router、Tailwind 4 和静态导出兼容性。
3. 检查是否引入 Motion、Framer Motion、GSAP、WebGL 或其他动画引擎。
4. 检查 bundle、运行时 CPU、键盘、焦点、ARIA 和 reduced-motion。
5. 与原创 CSS + Anime.js 方案比较维护成本和可验证收益。
6. 只有明显更优且全部边界通过时才采用，并记录真实使用文件。
7. 全站改造必须记录被拒绝候选；现有 React、CSS 与唯一动画引擎足够时，0 个采用是
   完整结论，不以数量衡量审计质量。

## 安全边界

- 禁止 Pro 模板、Pro Blocks、完整模板页和许可证不清楚的代码。
- React Bits 最多 2 个、Uiverse 最多 2 个；Aceternity 默认只作设计参考。
- 不复制第三方 Demo、品牌素材或未采用代码进仓库。

## 输出

- 对每个候选给出采用/拒绝、理由、许可证、依赖和实际使用数量。
