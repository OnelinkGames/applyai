import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveProjectPath } from '../db.js';

const RESUME_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

export function resolveResumePath(resumePath) {
  if (!resumePath?.trim()) return null;
  return resolveProjectPath(resumePath.trim());
}

export function getResumePathStatus(resumePath) {
  const absolutePath = resolveResumePath(resumePath);
  if (!absolutePath) {
    return { exists: false, absolutePath: null };
  }
  return { exists: fs.existsSync(absolutePath), absolutePath };
}

export function validateResumeFile(resumePath) {
  const { exists, absolutePath } = getResumePathStatus(resumePath);
  if (!absolutePath) {
    const error = new Error('Caminho do currículo não informado');
    error.status = 400;
    throw error;
  }
  if (!exists) {
    const error = new Error(`Arquivo de currículo não encontrado: ${absolutePath}`);
    error.status = 400;
    throw error;
  }
  const ext = path.extname(absolutePath).toLowerCase();
  if (!RESUME_EXTENSIONS.has(ext)) {
    const error = new Error('Selecione um arquivo .md, .markdown ou .txt');
    error.status = 400;
    throw error;
  }
  return absolutePath;
}

function getInitialDirectory(currentPath) {
  const resolved = resolveResumePath(currentPath);
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

function pickLinux(initialDir) {
  if (commandExists('zenity')) {
    return runCommand('zenity', [
      '--file-selection',
      '--title=Selecionar currículo base',
      `--filename=${initialDir}/`,
      '--file-filter=Markdown | *.md *.markdown',
      '--file-filter=Texto | *.txt',
      '--file-filter=Todos | *',
    ]);
  }

  if (commandExists('kdialog')) {
    return runCommand('kdialog', [
      '--getopenfilename',
      initialDir,
      '*.md *.markdown *.txt|Markdown e texto (*.md *.markdown *.txt)',
      'Selecionar currículo base',
    ]);
  }

  const error = new Error(
    'Instale zenity ou kdialog para selecionar arquivos, ou informe o caminho manualmente'
  );
  error.status = 501;
  throw error;
}

function pickMac(initialDir) {
  const script = `
    set defaultPath to POSIX file "${initialDir.replace(/"/g, '\\"')}"
    try
      set chosenFile to choose file with prompt "Selecionar currículo base" default location defaultPath
      return POSIX path of chosenFile
    on error number -128
      return ""
    end try
  `;
  const selected = runCommand('osascript', ['-e', script]);
  return selected || null;
}

function pickWindows(initialDir) {
  const escapedDir = initialDir.replace(/'/g, "''");
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Selecionar currículo base'
    $dialog.InitialDirectory = '${escapedDir}'
    $dialog.Filter = 'Markdown (*.md)|*.md|Texto (*.txt)|*.txt|Todos (*.*)|*.*'
    if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }
  `;
  const selected = runCommand('powershell', ['-NoProfile', '-Command', script]);
  return selected || null;
}

export function pickResumeFile(currentPath) {
  const initialDir = getInitialDirectory(currentPath);

  let selectedPath = null;
  if (process.platform === 'linux') {
    selectedPath = pickLinux(initialDir);
  } else if (process.platform === 'darwin') {
    selectedPath = pickMac(initialDir);
  } else if (process.platform === 'win32') {
    selectedPath = pickWindows(initialDir);
  } else {
    const error = new Error('Seleção de arquivo não suportada neste sistema operacional');
    error.status = 501;
    throw error;
  }

  if (!selectedPath) return null;

  return validateResumeFile(selectedPath);
}
