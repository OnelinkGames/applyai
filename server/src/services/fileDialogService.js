import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveProjectPath } from '../db.js';

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

function resolveConfiguredPath(configuredPath) {
  if (!configuredPath?.trim()) return null;
  return resolveProjectPath(configuredPath.trim());
}

function getPathStatus(configuredPath) {
  const absolutePath = resolveConfiguredPath(configuredPath);
  if (!absolutePath) {
    return { exists: false, absolutePath: null };
  }
  return { exists: fs.existsSync(absolutePath), absolutePath };
}

function validateTextFile(configuredPath, label) {
  const { exists, absolutePath } = getPathStatus(configuredPath);
  if (!absolutePath) {
    const error = new Error(`Caminho do ${label} não informado`);
    error.status = 400;
    throw error;
  }
  if (!exists) {
    const error = new Error(`Arquivo não encontrado: ${absolutePath}`);
    error.status = 400;
    throw error;
  }
  const ext = path.extname(absolutePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    const error = new Error('Selecione um arquivo .txt, .md ou .markdown');
    error.status = 400;
    throw error;
  }
  return absolutePath;
}

function getInitialDirectory(currentPath) {
  const resolved = resolveConfiguredPath(currentPath);
  if (resolved && fs.existsSync(resolved)) {
    return path.dirname(resolved);
  }
  return os.homedir();
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function commandExists(command) {
  const result = spawnSync('which', [command], { encoding: 'utf-8' });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function pickLinux(initialDir, title) {
  if (commandExists('zenity')) {
    return runCommand('zenity', [
      '--file-selection',
      `--title=${title}`,
      `--filename=${initialDir}/`,
      '--file-filter=Texto | *.txt',
      '--file-filter=Markdown | *.md *.markdown',
      '--file-filter=Todos | *',
    ]);
  }

  if (commandExists('kdialog')) {
    return runCommand('kdialog', [
      '--getopenfilename',
      initialDir,
      '*.txt *.md *.markdown|Texto e Markdown (*.txt *.md *.markdown)',
      title,
    ]);
  }

  const error = new Error(
    'Instale zenity ou kdialog para selecionar arquivos, ou informe o caminho manualmente'
  );
  error.status = 501;
  throw error;
}

function pickMac(initialDir, title) {
  const script = `
    set defaultPath to POSIX file "${initialDir.replace(/"/g, '\\"')}"
    try
      set chosenFile to choose file with prompt "${title.replace(/"/g, '\\"')}" default location defaultPath
      return POSIX path of chosenFile
    on error number -128
      return ""
    end try
  `;
  const selected = runCommand('osascript', ['-e', script]);
  return selected || null;
}

function pickWindows(initialDir, title) {
  const escapedDir = initialDir.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = '${escapedTitle}'
    $dialog.InitialDirectory = '${escapedDir}'
    $dialog.Filter = 'Texto (*.txt)|*.txt|Markdown (*.md)|*.md|Todos (*.*)|*.*'
    if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
  `;
  const selected = runCommand('powershell', ['-NoProfile', '-Command', script]);
  return selected || null;
}

function pickTextFile(currentPath, title) {
  const initialDir = getInitialDirectory(currentPath);

  let selectedPath = null;
  if (process.platform === 'linux') {
    selectedPath = pickLinux(initialDir, title);
  } else if (process.platform === 'darwin') {
    selectedPath = pickMac(initialDir, title);
  } else if (process.platform === 'win32') {
    selectedPath = pickWindows(initialDir, title);
  } else {
    const error = new Error('Seleção de arquivo não suportada neste sistema operacional');
    error.status = 501;
    throw error;
  }

  return selectedPath || null;
}

export function resolveResumePath(resumePath) {
  return resolveConfiguredPath(resumePath);
}

export function getResumePathStatus(resumePath) {
  return getPathStatus(resumePath);
}

export function validateResumeFile(resumePath) {
  return validateTextFile(resumePath, 'currículo');
}

export function pickResumeFile(currentPath) {
  const selectedPath = pickTextFile(currentPath, 'Selecionar currículo base');
  if (!selectedPath) return null;
  return validateResumeFile(selectedPath);
}

export function getSearchQueryPathStatus(searchQueryPath) {
  return getPathStatus(searchQueryPath);
}

export function validateSearchQueryFile(searchQueryPath) {
  return validateTextFile(searchQueryPath, 'arquivo de critérios de busca');
}

export function pickSearchQueryFile(currentPath) {
  const selectedPath = pickTextFile(currentPath, 'Selecionar critérios de busca');
  if (!selectedPath) return null;
  return validateSearchQueryFile(selectedPath);
}
