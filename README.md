# 中国节假日日历 Edge 扩展

[![CI](https://github.com/WongSilver/calendar-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/WongSilver/calendar-extension/actions/workflows/ci.yml)
[![Release](https://github.com/WongSilver/calendar-extension/actions/workflows/release.yml/badge.svg)](https://github.com/WongSilver/calendar-extension/actions/workflows/release.yml)

一个采用 Manifest V3 的 Edge 浏览器扩展，用于查看公历、农历、中国法定节假日、调休工作日和假期倒计时。

## 功能

- 公历、农历、干支、生肖、节气和数九信息
- 法定假期与调休工作日标记
- 月度工作日、休息日、假期和调休统计
- 下一个节假日倒计时及日期范围
- 月份、年份、按钮和滚轮导航
- 周日或周一作为一周起始日
- 小、中、大三档字号
- 亮色、暗色和跟随系统主题

## 节假日数据

节假日数据来自 `https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json`。

- 首次安装且没有本地缓存时自动请求节假日数据。
- 缓存未满 7 天时直接读取 `localStorage`，不会重复请求。
- 缓存满 7 天后先显示已有数据，再在后台自动刷新。
- 自动刷新遇到临时网络故障时会重试，失败不会删除已有缓存。
- 用户也可以通过设置中的刷新按钮立即更新。
- 更新成功后才替换缓存；请求失败时继续使用原有数据。
- 没有缓存且网络不可用时，基础日历和周末判断仍可使用。

## 本地开发

项目使用 [Bun](https://bun.sh/) 管理依赖和脚本。

```bash
bun install
bun run dev
```

开发页面默认运行在 `http://localhost:3000`，画布尺寸与 Edge 扩展弹窗一致。

可用命令：

```bash
bun run dev      # 启动开发预览
bun run lint     # 运行 ESLint
bun run build    # 类型检查并构建扩展到 dist/
bun run preview  # 预览 dist/ 构建结果
```

开发预览和生产扩展共用 `index.html`、`src/main.tsx` 和 `src/index.css`。`bun run build` 直接生成完整的 Manifest V3 扩展，不需要执行资源复制、路径替换、脚本抽取或 CSS 注入。

## 在 Edge 中安装

1. 执行 `bun run build`。
2. 在 Edge 打开 `edge://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择项目的 `dist/` 目录。

## 项目结构

```text
calendar-extension/
├── .github/workflows/      # CI 与标签发布工作流
├── public/
│   ├── _locales/           # 扩展本地化文案
│   ├── icons/              # 扩展图标
│   └── manifest.json       # Manifest V3 配置
├── src/
│   ├── components/         # 日历、侧栏和基础 UI 组件
│   ├── lib/                # 日期算法与节假日缓存
│   ├── index.css           # 全局主题和扩展固定尺寸
│   └── main.tsx            # React 入口
├── index.html              # 开发与扩展共用入口
└── vite.config.ts          # Vite 开发及构建配置
```

## GitHub Actions

仓库包含两个工作流：

- `CI`：推送到 `main`/`master` 或提交 Pull Request 时，安装锁定依赖、运行 ESLint、执行类型检查和 Vite 构建，并上传 `dist/` 作为构建产物。
- `Release`：推送 `v*` 标签时，校验标签、`package.json` 与 `public/manifest.json` 的版本一致，构建扩展，将 `dist/` 根目录压缩为 ZIP，并创建 GitHub Release。

发布新版本前，同时更新 `package.json` 和 `public/manifest.json` 中的版本，然后创建标签：

```bash
git tag v1.0.3
git push origin v1.0.3
```

## 技术栈

- Vite
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui 与 Radix UI
- date-fns
- lunar-typescript

## 许可证

MIT License
