# AGENTS.md

本文件适用于仓库根目录及其全部子目录，供在本项目中工作的编码代理参考。

## 项目概览

- 这是一个中国节假日日历 Edge Manifest V3 扩展。
- 主要技术栈：Vite、React 19、TypeScript、Tailwind CSS 4、shadcn/ui、`date-fns`、`lunar-typescript`。
- 使用 Bun 管理依赖和运行脚本，锁文件是 `bun.lock`。
- 项目完全在浏览器客户端运行，不要引入服务端运行时依赖。
- 开发页面就是扩展弹窗预览，固定尺寸为 `684x446`，开发与生产共用同一个 HTML 入口和 CSS。
- UI 和文案默认使用简体中文。

## 目录职责

- `index.html`：Vite 与扩展弹窗共用的 HTML 入口。
- `src/main.tsx`：React 根入口、主题 Provider 和全局 Toaster。
- `src/index.css`：Tailwind 入口、主题变量和扩展固定尺寸。
- `src/components/ChineseCalendar.tsx`：主状态容器，负责日历导航、设置、滚轮交互和节假日数据初始化/刷新。
- `src/components/CalendarDayCell.tsx`：单个日期格、农历和节假日状态显示。
- `src/components/CalendarSidebar.tsx`：日期详情、月度统计和未来节假日。
- `src/components/ui/`：shadcn/ui 基础组件。除非任务要求，不要批量改写或格式化这些组件。
- `src/lib/calendar.ts`：农历转换、年份边界、字号配置和固定布局尺寸。
- `src/lib/holidays.ts`：节假日 API 转换、内存索引和 `localStorage` 缓存。
- `public/manifest.json`、`public/icons/`、`public/_locales/`：扩展源资源，Vite 构建时原样复制到 `dist/`。
- `dist/`：完整的扩展构建产物，可直接在 Edge 中加载，不要手工编辑或提交。

## 常用命令

```bash
bun install
bun run dev
bun run lint
bun run build
bun run preview
```

- `bun run dev` 在 `http://localhost:3000` 启动开发预览。
- `bun run build` 先运行 TypeScript 检查，再直接生成可加载的扩展到 `dist/`。
- `bun run preview` 预览最新的 `dist/`。
- 不存在额外的扩展打包脚本。不要添加复制、重命名、HTML 字符串替换、内联脚本抽取或 CSS 注入步骤；扩展需要的结构应通过 Vite 配置、源码和 `public/` 资源直接产生。
- 仓库目前没有自动化测试脚本。涉及日期算法、缓存或交互时，除 lint、类型检查和构建外，还要手动验证对应场景。

## 架构与数据约束

- 日历主体始终生成 42 个日期格。月滚动模式从当月首日所在周开始，周滚动模式从当前日期所在周开始。
- 支持年份范围为 1900 至 2100；修改导航逻辑时保持下拉选项、按钮导航和滚轮导航的边界一致。
- 节假日数据源为 `https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json`。若更换域名，还必须同步更新 `public/manifest.json` 的 `host_permissions`。
- 节假日 API 数据会转换为 `{ name, date, type }`，日期格式固定为本地日历语义的 `YYYY-MM-DD`，`type` 只能是 `holiday` 或 `workday`。
- 节假日缓存键为 `chinese-holidays-cache` 和 `chinese-holidays-cache-time`。缓存默认永久有效，仅在用户手动刷新成功后原子替换。
- 用户设置存储在 `chinese-calendar-settings`，新增设置字段时应提供默认值，并保持对旧缓存的兼容合并。
- 外部 API 不可用时，界面仍应能用周末规则展示基础日历；不要让请求失败阻塞日历使用，也不要在失败时删除已有缓存。
- 主题由 `next-themes` 管理；读取主题或浏览器 API 时继续处理首次挂载状态。

## UI 与扩展约束

- Edge 弹窗和开发页面共用 `684x446` 固定画布。调整尺寸时同步检查 `src/index.css` 与 `src/lib/calendar.ts` 的 `LAYOUT`。
- `CalendarSidebar` 各模块高度之和依赖固定的 `438px` 日历高度；调整模块时维持总高度和间距预算。
- 复用现有 shadcn/ui 组件、Tailwind 工具类和 `lucide-react` 图标；通用 class 合并使用 `cn()`。
- 纯图标按钮必须提供准确的 `aria-label` 和 tooltip 或 `title`。
- 保持亮色、暗色和跟随系统三种主题可用。新增颜色时同时检查 `dark:` 状态。
- 日期格、侧边栏和弹窗空间紧凑，新增文案必须检查截断、换行和三档字号设置。

## 编码约定

- TypeScript 保持 `strict` 兼容，优先补充明确类型，避免扩大 `any` 的使用。
- 使用 `@/` 引用 `src/` 下的模块，避免层层相对路径。
- 保持正在编辑文件的现有引号和格式风格，不要为无关文件做全仓格式化。
- 日期计算优先使用 `date-fns` 或现有辅助函数；农历计算使用 `lunar-typescript`，不要复制实现另一套算法。
- 对 `Date` 和 `YYYY-MM-DD` 字符串转换要明确本地时区语义。解析 API 日期时沿用 `T00:00:00`，避免 UTC 解析造成日期偏移。
- 修改共享类型时同步检查 `ChineseCalendar`、`CalendarDayCell`、`CalendarSidebar` 和 `src/lib/` 中的所有调用方。
- 注释用于解释日期边界、缓存策略、CSP 或扩展约束等非直观逻辑，不重复描述代码本身。

## 构建与发布注意事项

- `vite.config.ts` 使用相对资源基址 `./`，以保证 `index.html` 在扩展协议下正确加载 `assets/`。
- `dist/index.html` 不得包含内联执行脚本，所有运行代码应由 Vite 输出到 `dist/assets/`，以满足 Manifest V3 CSP。
- 发布版本时同步更新 `package.json` 和 `public/manifest.json` 的版本号；需要时一并更新 `README.md` 的版本历史。
- 不要提交 `dist/`、压缩包、日志、环境文件或本地缓存。

## 提交前检查

1. 运行 `bun run lint`。
2. 运行 `bun run build`。
3. 确认 `dist/manifest.json`、`dist/index.html`、`dist/assets/`、`dist/icons/` 和 `dist/_locales/` 存在。
4. 在 Edge 中加载 `dist/`，检查当前日期、年月导航、年份边界、周起始日、月/周滚动、日期选择和三档字号。
5. 涉及节假日逻辑时检查首次无缓存、已有缓存、手动刷新、请求失败、假期、调休工作日和普通周末。
6. 检查亮色/暗色主题、设置弹层、无障碍名称，以及弹窗中是否有溢出或裁切。
7. 用 `git status` 确认没有误提交构建产物或无关文件。
