import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = './public/assets';

// 获取所有 PNG 文件
const files = fs.readdirSync(assetsDir)
  .filter(file => file.endsWith('.png'))
  .map(file => path.join(assetsDir, file));

console.log(`Found ${files.length} PNG files to compress`);

// 压缩每个文件
for (const file of files) {
  const stats = fs.statSync(file);
  const originalSize = stats.size;

  // 读取图片信息
  const metadata = await sharp(file).metadata();

  // 如果图片太大，进行压缩
  if (originalSize > 500000) { // 大于 500KB
    const tempFile = file + '.tmp';

    await sharp(file)
      .resize({
        width: Math.min(metadata.width, 256), // 最大宽度 256
        height: Math.min(metadata.height, 256), // 最大高度 256
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(tempFile);

    const newSize = fs.statSync(tempFile).size;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    // 替换原文件
    fs.renameSync(tempFile, file);

    console.log(`✓ ${path.basename(file)}: ${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB (${savings}% saved)`);
  } else {
    // 小文件只进行无损压缩
    const tempFile = file + '.tmp';
    await sharp(file)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(tempFile);

    const newSize = fs.statSync(tempFile).size;
    if (newSize < originalSize) {
      fs.renameSync(tempFile, file);
      const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);
      console.log(`✓ ${path.basename(file)}: ${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB (${savings}% saved)`);
    } else {
      fs.unlinkSync(tempFile);
      console.log(`- ${path.basename(file)}: already optimized`);
    }
  }
}

console.log('\nCompression complete!');
