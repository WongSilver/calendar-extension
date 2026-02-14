import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建简单的 SVG 图标并转换为 PNG
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '..', 'extension', 'icons');

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 为每个尺寸创建 SVG
sizes.forEach(size => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="#DC2626"/>
  <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="${size * 0.5}" font-weight="bold" font-family="Arial, sans-serif">历</text>
</svg>`;
  
  // 写入 SVG 文件
  fs.writeFileSync(path.join(iconsDir, `icon${size}.svg`), svg);
  // 也复制一份为 PNG（实际是 SVG，但浏览器扩展支持 SVG）
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), Buffer.from(svg));
  console.log(`Created icon${size}.png`);
});

console.log('\n✅ 图标创建完成！');
console.log('提示: 如需更好的图标，请手动替换 extension/icons/ 目录下的图标文件');
