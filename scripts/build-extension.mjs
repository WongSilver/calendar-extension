import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const outDir = path.join(__dirname, '..', 'out');
const extensionDir = path.join(__dirname, '..', 'extension');

console.log('🚀 开始构建 Edge 扩展...\n');

// 检查 out 目录是否存在，不存在则先构建
if (!fs.existsSync(outDir)) {
  console.log('📦 未找到 out 目录，开始构建 Next.js 项目...');
  await $`bun run build`.quiet();
  console.log('✅ Next.js 构建完成\n');
}

// 清空 extension 目录中的旧文件（保留 icons 和 manifest.json）
const itemsToKeep = ['icons', 'manifest.json', 'logo.svg', '_locales'];
if (fs.existsSync(extensionDir)) {
  const items = fs.readdirSync(extensionDir);
  items.forEach(item => {
    if (!itemsToKeep.includes(item)) {
      const itemPath = path.join(extensionDir, item);
      if (fs.lstatSync(itemPath).isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    }
  });
}

// 复制 out 目录中的所有文件到 extension 目录
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(outDir, extensionDir);
console.log('✅ 静态文件已复制到 extension 目录');

// 复制 public 目录中的静态资源
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  publicFiles.forEach(file => {
    if (file !== 'robots.txt') { // 不复制 robots.txt
      const srcPath = path.join(publicDir, file);
      const destPath = path.join(extensionDir, file);
      if (fs.lstatSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ 复制 ${file}`);
      }
    }
  });
}

// 重命名 _next 目录为 next-assets（Edge 扩展不允许下划线开头）
const nextDir = path.join(extensionDir, '_next');
const newNextDir = path.join(extensionDir, 'next-assets');

if (fs.existsSync(nextDir)) {
  if (fs.existsSync(newNextDir)) {
    fs.rmSync(newNextDir, { recursive: true, force: true });
  }
  fs.renameSync(nextDir, newNextDir);
  console.log('✅ 已将 _next 重命名为 next-assets');
}

// 更新所有 HTML 和 JS 文件中的 _next 引用
function replaceInFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInFiles(fullPath);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('/_next/')) {
        content = content.replace(/\/_next\//g, '/next-assets/');
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

replaceInFiles(extensionDir);
console.log('✅ 已更新所有文件中的 _next 引用');

// 移除调试边框
function removeDebugBorder(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDebugBorder(fullPath);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // 移除 debug-extension-border 类名
      if (content.includes('debug-extension-border')) {
        content = content.replace(/\s*debug-extension-border\s*/g, ' ');
        content = content.replace(/\s+/g, ' ').replace(/class="\s*"/g, 'class=""');
        modified = true;
      }

      // 移除 DEBUG-BORDER 注释
      if (content.includes('DEBUG-BORDER')) {
        content = content.replace(/\/\*\s*DEBUG-BORDER[^*]*\*\//g, '');
        modified = true;
      }

      // 移除 CSS 中的调试边框样式
      if (content.includes('.debug-extension-border')) {
        content = content.replace(/\.debug-extension-border\s*\{[^}]*\}/g, '');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

removeDebugBorder(extensionDir);
console.log('✅ 已移除调试边框');

// 提取内联脚本到外部文件（修复 CSP 问题）
function extractInlineScripts(htmlPath) {
  let content = fs.readFileSync(htmlPath, 'utf8');
  let scriptCounter = 0;
  const inlineScriptDir = path.join(extensionDir, 'inline-scripts');

  // 创建存放内联脚本的目录
  if (!fs.existsSync(inlineScriptDir)) {
    fs.mkdirSync(inlineScriptDir, { recursive: true });
  }

  // 匹配非 src 的 script 标签（内联脚本）
  const inlineScriptRegex = /<script(?![^>]*\ssrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

  content = content.replace(inlineScriptRegex, (match, scriptContent) => {
    // 跳过空脚本
    if (!scriptContent || !scriptContent.trim()) {
      return match;
    }

    scriptCounter++;
    const scriptFileName = `inline-${Date.now()}-${scriptCounter}.js`;
    const scriptFilePath = path.join(inlineScriptDir, scriptFileName);

    // 写入外部脚本文件
    fs.writeFileSync(scriptFilePath, scriptContent, 'utf8');

    // 返回外部脚本引用
    return `<script src="/inline-scripts/${scriptFileName}"></script>`;
  });

  // 写回更新后的 HTML
  fs.writeFileSync(htmlPath, content, 'utf8');

  return scriptCounter;
}

// 处理所有 HTML 文件
function processHtmlFiles(dir) {
  let totalExtracted = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      totalExtracted += processHtmlFiles(fullPath);
    } else if (entry.name.endsWith('.html')) {
      const count = extractInlineScripts(fullPath);
      totalExtracted += count;
      if (count > 0) {
        console.log(`  📄 ${entry.name}: 提取了 ${count} 个内联脚本`);
      }
    }
  }
  return totalExtracted;
}

const extractedCount = processHtmlFiles(extensionDir);
console.log(`✅ 已提取 ${extractedCount} 个内联脚本到外部文件`);

// 注入扩展模式样式到 index.html
const indexHtmlPath = path.join(extensionDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  // 扩展模式专用样式 - 固定尺寸
  // 宽度: 日历520 + 侧边栏150 + 间距6 + 内边距8 = 684px
  // 高度: 日历438 + 内边距8 = 446px
  const extensionStyles = `
<style id="extension-mode-styles">
html, body {
  width: 684px !important;
  height: 446px !important;
  min-width: 684px !important;
  min-height: 446px !important;
  max-width: 684px !important;
  max-height: 446px !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
}
body > main {
  width: 684px !important;
  height: 446px !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
}
</style>`;

  // 在 </head> 前插入样式
  if (!htmlContent.includes('extension-mode-styles')) {
    htmlContent = htmlContent.replace('</head>', extensionStyles + '</head>');
    fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
    console.log('✅ 已注入扩展模式固定尺寸样式 (684x446)');
  }
}

// 删除不需要的文件
const filesToDelete = [
  '404.html',
  '404',
  '_not-found',
  'robots.txt',
  '__next.__PAGE__.txt',
  '__next._full.txt',
  '__next._head.txt',
  '__next._index.txt',
  '__next._tree.txt',
  'index.txt'
];

filesToDelete.forEach(file => {
  const filePath = path.join(extensionDir, file);
  if (fs.existsSync(filePath)) {
    if (fs.lstatSync(filePath).isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }
});
console.log('✅ 已清理不需要的文件');

// 检查图标是否存在
const iconsDir = path.join(extensionDir, 'icons');
const requiredIcons = ['icon16.png', 'icon48.png', 'icon128.png'];
const missingIcons = requiredIcons.filter(icon => !fs.existsSync(path.join(iconsDir, icon)));

if (missingIcons.length > 0) {
  console.log(`\n⚠️  缺少图标文件: ${missingIcons.join(', ')}`);
  console.log('   请将图标文件放入 extension/icons/ 目录');
  console.log('   图标尺寸: 16x16, 48x48, 128x128 像素\n');
}

console.log('\n🎉 Edge 扩展构建完成！');
console.log('📁 扩展目录: extension/');
console.log('\n📖 安装方法:');
console.log('   1. 打开 Edge 浏览器，访问 edge://extensions/');
console.log('   2. 开启"开发人员模式"');
console.log('   3. 点击"加载解压缩的扩展"');
console.log('   4. 选择 extension 目录\n');
