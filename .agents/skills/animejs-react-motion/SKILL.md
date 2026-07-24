---
name: animejs-react-motion
description: 按仓库实际 Anime.js 版本在 React 中实现有作用域、可清理、尊重 reduced-motion 且适合截图稳定化的有限动效。
---

# Anime.js React motion

## 触发

- React 页面需要首屏进入、区块揭示或菜单反馈动效时。

## 不触发

- 不用于永久循环、粒子、播放器、磁吸、3D、WebGL 或持续滚动动画。
- CSS 能清楚表达的静态布局不使用 Anime.js。

## 执行规则

1. 从 `package.json`、锁文件、包内类型声明和官方文档确认版本与 API。
2. React 动效使用 `createScope({ root })`，并在 effect 清理函数中调用
   `scope.revert()`。
3. 动画只修改 opacity 和 transform，保持内容在动画失败时仍可见。
4. 进入动画由 IntersectionObserver 有限触发；观察器在卸载时断开。
5. `prefers-reduced-motion: reduce` 或 `data-motion="reduced"` 时跳过动画。
6. `data-visual-test="true"` 时立即呈现最终状态，保证截图稳定。
7. 禁止永久 loop、无意义 requestAnimationFrame 和第二动画引擎。

## 安全边界

- 不在服务端访问 DOM，不跨组件根节点选取元素。
- 不让动效阻挡点击、改变语义 DOM 顺序或成为信息唯一载体。

## 输出

- 报告版本、官方 API 来源、作用域、清理路径和 reduced-motion 行为。
- 测试必须验证清理、静态可见回退和没有永久 RAF/loop。

