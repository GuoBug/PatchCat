#!/usr/bin/env node

/**
 * @file    scripts/build-target.mjs
 * @description
 *   Multi-target build orchestrator for PatchCat.
 *   Supports 'standard' (FastAPI server) and 'merlin' (Lightweight Go Gateway on Asuswrt-Merlin).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Parse arguments
const args = process.argv.slice(2);
let target = 'standard';
let arch = 'arm64';

for (const arg of args) {
  if (arg.startsWith('--target=')) {
    target = arg.split('=')[1].toLowerCase();
  } else if (arg.startsWith('--arch=')) {
    arch = arg.split('=')[1].toLowerCase();
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🐱 PatchCat Multi-Target Build Orchestrator`);
console.log(`🎯 Target Platform : [${target.toUpperCase()}]`);
if (target === 'merlin') {
  console.log(`⚙️  Target Arch     : [linux/${arch}] (ASUS RT-AX86U: arm64)`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Helper to execute commands synchronously
function run(cmd, envOverrides = {}) {
  console.log(`\x1b[36m➜ ${cmd}\x1b[0m`);
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...envOverrides },
  });
}

// Check if a command is available
function hasCommand(command) {
  try {
    const checkCmd = process.platform === 'win32' ? `where.exe ${command}` : `which ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (target === 'merlin') {
  const merlinPkgDir = path.join(rootDir, 'merlin_pkg');
  const binDir = path.join(merlinPkgDir, 'bin');
  const pkgDistDir = path.join(merlinPkgDir, 'dist');
  const targetBinPath = path.join(binDir, 'patchcat-server');
  const outputArchive = path.join(rootDir, `patchcat-merlin-${arch}.tar.gz`);

  // Step 1: Build Frontend SPA with relative base path
  console.log('📦 [1/3] 编译前端静态产物 (Vite Relative Path)...');
  run('npm run build', { VITE_BASE_PATH: './' });

  // Sync dist into merlin_pkg
  console.log('📋 同步 dist 到梅林插件目录...');
  if (fs.existsSync(pkgDistDir)) {
    fs.rmSync(pkgDistDir, { recursive: true, force: true });
  }
  copyDirSync(path.join(rootDir, 'dist'), pkgDistDir);

  // Step 2: Build or verify Go Gateway Binary
  console.log(`\n🔨 [2/3] 准备轻量 Go 网关二进制 (linux/${arch})...`);
  fs.mkdirSync(binDir, { recursive: true });

  const goAvailable = hasCommand('go');
  let buildSuccess = false;

  if (goAvailable) {
    console.log(`✨ 检测到 Go 编译器，执行跨平台静态交叉编译...`);
    const goArch = arch === 'arm64' ? 'arm64' : (arch === 'arm' || arch === 'armv7') ? 'arm' : arch;
    const goArm = (arch === 'arm' || arch === 'armv7') ? 'GOARM=7' : '';
    const goCmd = process.platform === 'win32'
      ? `cd gateway && set GOOS=linux&& set GOARCH=${goArch}&& set CGO_ENABLED=0&& go build -ldflags="-s -w" -o "${targetBinPath}" .`
      : `cd gateway && GOOS=linux GOARCH=${goArch} ${goArm} CGO_ENABLED=0 go build -ldflags="-s -w" -o "${targetBinPath}" .`;

    try {
      run(goCmd);
      buildSuccess = true;
      console.log(`✅ Go Gateway 二进制编译成功: ${targetBinPath}`);
    } catch (e) {
      console.warn(`⚠️ Go 编译出错: ${e.message}`);
    }
  } else {
    console.warn(`⚠️ 本地未检测到 Go 编译器 (go)。`);
    if (fs.existsSync(targetBinPath)) {
      console.log(`ℹ️ 检测到已有现成二进制: ${targetBinPath}，将直接打包使用。`);
      buildSuccess = true;
    } else {
      console.log(`\n💡 提示: 您可以直接使用以下两种方式获取编译产物:`);
      console.log(`   1. 在安装有 Go 的环境中运行: GOOS=linux GOARCH=${arch} CGO_ENABLED=0 go build -ldflags="-s -w" -o merlin_pkg/bin/patchcat-server ./gateway/main.go`);
      console.log(`   2. 触发项目的 GitHub Actions (.github/workflows/build-merlin.yml) 自动编译下载.`);
    }
  }

  // Step 3: Package into .tar.gz archive with top-level 'patchcat/' directory
  console.log(`\n📦 [3/3] 打包为梅林离线安装包 (Koolcenter 标准格式)...`);
  const stagingDir = path.join(rootDir, 'merlin_staging');
  const stagedPatchcatDir = path.join(stagingDir, 'patchcat');
  try {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    copyDirSync(merlinPkgDir, stagedPatchcatDir);

    // Pack with top-level 'patchcat/' folder
    execSync(`tar -czf "${outputArchive}" -C "${stagingDir}" patchcat`, { cwd: rootDir, stdio: 'inherit' });
    fs.rmSync(stagingDir, { recursive: true, force: true });

    const stat = fs.statSync(outputArchive);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
    console.log('\n🎉 ==========================================================');
    console.log(`✅ 梅林离线安装包打包完成！`);
    console.log(`📦 产物路径: ${outputArchive}`);
    console.log(`📊 压缩大小: ${sizeMB} MB`);
    console.log(`🚀 安装方法:`);
    console.log(`   1. 打开华硕梅林后台 (http://192.168.50.1) -> 软件中心;`);
    console.log(`   2. 点击【离线安装】，上传 patchcat-merlin-${arch}.tar.gz;`);
    console.log(`   3. 安装后点击开启，在局域网输入 http://192.168.50.1:8899 即可全屏打开 PatchCat！`);
    console.log('==========================================================\n');
  } catch (err) {
    console.error(`❌ 打包 .tar.gz 失败: ${err.message}`);
  }

} else {
  // Standard Build
  console.log('📦 执行标准构建 (Target = standard)...');
  run('npm run build');
  console.log('\n✅ 标准前端产物构建完成 (dist/)。');
  console.log('💡 标准模式下后端服务请运行: cd server && docker compose up -d');
}
