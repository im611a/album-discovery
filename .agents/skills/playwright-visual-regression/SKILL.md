---
name: playwright-visual-regression
description: 使用固定本地数据和视口执行 Playwright 功能、可访问性、网络、横向溢出与 Chromium 视觉回归。
---

# Playwright visual regression

## 触发

- 需要真实浏览器验证静态页面、深层路由、响应式或视觉基准时。

## 不触发

- 不替代 Vitest 纯逻辑和组件测试。
- 不把第三方参考站截图作为本站像素基准。

## 执行规则

1. 从实际 Playwright 版本官方文档和类型声明建立配置。
2. 固定目录数据、时区、色彩模式和视口；截图前等待图片加载与解码。
3. Chromium 保存本站视觉基准；Firefox、WebKit仅做可用性冒烟。
4. 截图时设置稳定模式并禁用动画；使用经过人工审阅的合理差异阈值。
5. 检查 console、pageerror、外部网络请求、深层刷新和横向溢出。
6. 覆盖键盘导航、移动菜单 Esc、200% 缩放与 reduced-motion。
7. 参考站观察输出仅进入 `.local-data`，不保存源码、完整 DOM 或素材。

## 安全边界

- 不读取或保存 Cookie、localStorage、参考站源码、JS bundle 或 source map。
- 不向音乐数据源发起请求，不把测试报告和临时截图打入交付 ZIP。

## 输出

- 报告浏览器、视口、路由、截图差异、console/network 和失败场景。
- 未安装或无法运行的浏览器必须标为 PARTIAL，不得写成通过。

