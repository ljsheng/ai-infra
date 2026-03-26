#!/usr/bin/env node
/**
 * Sync mapped GitHub directories into local skills folders.
 *
 * 改进点（相比旧版串行 spawnSync）：
 * 1. 所有 git 操作带 120s 超时，网络卡顿时自动终止而非永久阻塞
 * 2. 仓库组并行拉取（默认 5 路并发），总耗时缩短 5-6 倍
 * 3. 实时进度指示（X/Y 完成数）
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { runCommand } = require('./utils');

const GIT_TIMEOUT = 120_000; // 单次 git 操作超时 120s
const CONCURRENCY = 5; // 最大并行拉取数

function showHelp() {
  console.log(`Usage:
  npm run sync:skills
  node ./scripts/sync-skills.js [--map <file>] [--dest <dir>] [--dry-run] [--concurrency <n>]
`);
}

function parseArgs(argv) {
  const options = {
    map: 'skills-map.txt',
    dest: 'skills',
    dryRun: false,
    concurrency: CONCURRENCY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '-h' || token === '--help') {
      options.help = true;
      continue;
    }
    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (token === '--map') {
      options.map = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--map=')) {
      options.map = token.slice('--map='.length);
      continue;
    }
    if (token === '--dest') {
      options.dest = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--dest=')) {
      options.dest = token.slice('--dest='.length);
      continue;
    }
    if (token === '--concurrency') {
      options.concurrency = Math.max(1, parseInt(argv[index + 1], 10) || CONCURRENCY);
      index += 1;
      continue;
    }
    if (token.startsWith('--concurrency=')) {
      options.concurrency = Math.max(1, parseInt(token.slice('--concurrency='.length), 10) || CONCURRENCY);
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function parseRemoteUrl(remoteUrl) {
  const parsed = new URL(remoteUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname !== 'github.com') {
    throw new Error('仅支持 https://github.com/... 格式。');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);

  // 支持仓库根 URL：https://github.com/<owner>/<repo>
  if (parts.length === 2) {
    return {
      owner: parts[0],
      repo: parts[1],
      ref: null, // 使用仓库默认分支
      remotePath: '.', // 仓库根目录
    };
  }

  if (parts.length < 5 || parts[2] !== 'tree') {
    throw new Error('URL 必须是 /<owner>/<repo>/tree/<ref>/<path> 或 /<owner>/<repo> 结构。');
  }

  const remotePath = decodeURIComponent(parts.slice(4).join('/').trim());
  if (!remotePath) {
    throw new Error('URL 中缺少远程目录路径。');
  }

  return {
    owner: parts[0],
    repo: parts[1],
    ref: parts[3],
    remotePath,
  };
}

function parseMappingLine(line, lineNumber) {
  if (!line.includes('=>')) {
    throw new Error(`skills-map.txt:${lineNumber}: 缺少 '=>' 分隔符。`);
  }

  const [remoteUrl, localDir] = line.split('=>').map((part) => part.trim());
  if (!remoteUrl || !localDir) {
    throw new Error(`skills-map.txt:${lineNumber}: 远程地址和本地目录都不能为空。`);
  }
  if (localDir === '.' || localDir === '/') {
    throw new Error(`skills-map.txt:${lineNumber}: 本地目录不能是 '.' 或 '/'。`);
  }

  return {
    remoteUrl,
    localDir,
    ...parseRemoteUrl(remoteUrl),
  };
}

function loadMappings(mappingFile) {
  if (!fs.existsSync(mappingFile)) {
    throw new Error(`映射文件不存在: ${mappingFile}`);
  }

  const lines = fs.readFileSync(mappingFile, 'utf8').split(/\r?\n/);
  const mappings = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }
    mappings.push(parseMappingLine(line, index + 1));
  });

  if (mappings.length === 0) {
    throw new Error(`映射文件为空: ${mappingFile}`);
  }

  return mappings;
}

function safeDest(destRoot, localDir) {
  const root = path.resolve(destRoot);
  const destination = path.resolve(root, localDir);
  const relative = path.relative(root, destination);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`本地目录越界或指向根目录: ${localDir}`);
  }

  return destination;
}

function validateUniqueDestinations(destRoot, mappings) {
  const seen = new Map();
  for (const mapping of mappings) {
    const destination = safeDest(destRoot, mapping.localDir);
    const existing = seen.get(destination);
    if (existing && existing.remoteUrl !== mapping.remoteUrl) {
      throw new Error(
        `本地目录冲突: ${destination}\n  - ${existing.remoteUrl}\n  - ${mapping.remoteUrl}`,
      );
    }
    seen.set(destination, mapping);
  }
}

function ensureGit() {
  const result = runCommand('git', ['--version']);
  if (result.status !== 0) {
    throw new Error('未检测到可用的 git，请先安装并确保在 PATH 中。');
  }
}

// ── 异步 git 执行（带超时） ──────────────────────────────

function runGitAsync(args, options = {}) {
  const timeout = options.timeout || GIT_TIMEOUT;
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: options.cwd,
      env: process.env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // 给 5s 优雅退出，否则强杀
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000);
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ status: null, stdout, stderr, timedOut: true });
      } else {
        resolve({ status: code, stdout, stderr, timedOut: false });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runGitChecked(args, options = {}) {
  const result = await runGitAsync(args, options);
  if (result.timedOut) {
    throw new Error(`超时 (${Math.round((options.timeout || GIT_TIMEOUT) / 1000)}s): git ${args.join(' ')}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stdout?.trim() || result.stderr?.trim() || `命令失败: git ${args.join(' ')}`);
  }
  return result;
}

// ── 并发控制 ───────────────────────────────────────────

async function parallelLimit(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const taskFn of tasks) {
    const p = taskFn().then(
      (val) => { executing.delete(p); return { ok: true, value: val }; },
      (err) => { executing.delete(p); return { ok: false, error: err }; },
    );
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ── 核心同步逻辑（异步版） ────────────────────────────────

async function cloneSparseGroupAsync(owner, repo, ref, remotePaths, workdir) {
  const refLabel = ref || 'HEAD';
  const checkoutDir = path.join(workdir, `${owner}_${repo}_${refLabel}`.replaceAll('/', '_'));

  const needsSparse = remotePaths.some((p) => p !== '.');

  const cloneArgs = ['clone', '--depth', '1', '--filter=blob:none'];
  if (needsSparse) {
    cloneArgs.push('--sparse');
  }
  if (ref) {
    cloneArgs.push('--branch', ref);
  }
  cloneArgs.push(`https://github.com/${owner}/${repo}.git`, checkoutDir);
  await runGitChecked(cloneArgs);

  if (needsSparse) {
    const sparsePaths = Array.from(new Set(remotePaths.filter((p) => p !== '.'))).sort();
    if (sparsePaths.length > 0) {
      await runGitChecked(['-C', checkoutDir, 'sparse-checkout', 'set', '--no-cone', ...sparsePaths]);
    }
  }

  return checkoutDir;
}

function syncOne(sourcePath, destinationPath, dryRun, isRepoRoot) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    throw new Error(`远程目录不存在: ${sourcePath}`);
  }
  if (dryRun) {
    return;
  }

  if (fs.existsSync(destinationPath)) {
    if (!fs.statSync(destinationPath).isDirectory()) {
      throw new Error(`本地目标不是目录: ${destinationPath}`);
    }
    fs.rmSync(destinationPath, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    filter: isRepoRoot ? (src) => !src.includes(`${path.sep}.git`) : undefined,
  });
}

async function processGroup(items, destRoot, tempDir, dryRun) {
  const [{ owner, repo, ref }] = items;
  const label = `${owner}/${repo}@${ref || 'HEAD'}`;
  const lines = [`==> 拉取 ${label}`];

  let checkoutDir;
  try {
    checkoutDir = await cloneSparseGroupAsync(
      owner,
      repo,
      ref,
      items.map((item) => item.remotePath),
      tempDir,
    );
  } catch (error) {
    const message = `${label} 拉取失败: ${error.message}`;
    lines.push(`[失败] ${message}`);
    return { lines, failures: [message] };
  }

  const failures = [];
  for (const item of items) {
    const destination = safeDest(destRoot, item.localDir);
    const sourcePath = path.join(checkoutDir, item.remotePath);
    lines.push(`  - ${item.remoteUrl} => ${destination}`);
    try {
      syncOne(sourcePath, destination, dryRun, item.remotePath === '.');
    } catch (error) {
      const message = `${item.remoteUrl} 同步失败: ${error.message}`;
      failures.push(message);
      lines.push(`[失败] ${message}`);
    }
  }

  return { lines, failures };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      showHelp();
      return 0;
    }

    ensureGit();
    const mappingFile = path.resolve(args.map);
    const destRoot = path.resolve(args.dest);
    const mappings = loadMappings(mappingFile);
    validateUniqueDestinations(destRoot, mappings);

    const grouped = new Map();
    for (const mapping of mappings) {
      const key = `${mapping.owner}/${mapping.repo}@${mapping.ref || 'HEAD'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(mapping);
    }

    const totalGroups = grouped.size;
    let completed = 0;
    const allFailures = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sync-'));

    console.log(`共 ${totalGroups} 个仓库组，并发 ${args.concurrency} 路拉取\n`);

    try {
      const tasks = [...grouped.values()].map((items) => () =>
        processGroup(items, destRoot, tempDir, args.dryRun).then((result) => {
          completed += 1;
          // 逐组输出，避免多组日志交错
          console.log(`[${completed}/${totalGroups}] ${result.lines.join('\n')}`);
          return result;
        }),
      );

      const results = await parallelLimit(tasks, args.concurrency);

      for (const r of results) {
        if (r.ok && r.value.failures.length > 0) {
          allFailures.push(...r.value.failures);
        }
        if (!r.ok) {
          allFailures.push(r.error.message);
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    if (allFailures.length > 0) {
      console.error('\n同步完成（有失败项）:');
      allFailures.forEach((failure) => console.error(`  - ${failure}`));
      return 1;
    }

    console.log(args.dryRun ? '\nDry-run 完成，未写入任何文件。' : '\n全部同步完成。');
    return 0;
  } catch (error) {
    console.error(`初始化失败: ${error.message}`);
    return 1;
  }
}

main().then((code) => process.exit(code));
