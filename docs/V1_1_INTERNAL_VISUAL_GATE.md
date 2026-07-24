# V1.1 内部视觉门

状态：`READY_FOR_HUMAN_REVIEW`

## 视觉门 A：首页动态

- 普通模式初始封面 0，滚动逐步进入且向上可逆。
- 1280、1440、1920 的五个指针位置通过零非法重叠检测。
- 单 RAF 稳定后停止；Deck 编号、标题、封面和黑胶共享 activeIndex。
- reduced-motion 与无 JavaScript 内容完整。

结果：`READY_FOR_SYSTEM_ROLLOUT`

## 视觉门 B：代表页面

首页、发现、搜索、艺人索引、艺人详情、专辑详情和移动菜单均有桌面/手机证据；
工具页保持操作效率，艺人与详情页使用有限叙事层级，没有复制首页重动效。

结果：`READY_FOR_FULL_SITE_ROLLOUT`

## 视觉门 C：全站

30 个场景完成桌面与手机截图、唯一 h1、横向溢出与 console 检查。Header、Footer、
空状态、404、专题、个人状态页面均迁入同一蓝黑宋体系统。

结果：`READY_FOR_HUMAN_REVIEW`

## 未替代的人工项

- Firefox 因本机图形环境启动超时：`PARTIAL`。
- 当前自动化不能可靠设置浏览器 UI 真实 200% 缩放：`PARTIAL`。
- WebKit 是 Safari 近似。
- 最终唯一预览目录仍需用户实际打开；release manifest 保持 `pending`。
