#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const androidResDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const instancePropertiesPath = path.join(projectRoot, 'android', 'app', 'territorios-instance.properties');

function readProperties(filePath) {
  const props = {};
  if (!fs.existsSync(filePath)) return props;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    props[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return props;
}

function normalizeInstance(value) {
  return String(value || 'palmas')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'palmas';
}

function resolvePublicAsset(assetPath) {
  return path.join(projectRoot, 'public', String(assetPath || '').replace(/^\.\//, '').replace(/^\//, ''));
}

const instance = normalizeInstance(readProperties(instancePropertiesPath).instance);
const env = readProperties(path.join(projectRoot, `.env.${instance}`));
const fallbackIcon = instance === 'general' ? '/icon-general-512.png' : '/icon-512.png';
const sourceIcon = resolvePublicAsset(env.VITE_APP_ICON_512 || fallbackIcon);

if (!fs.existsSync(sourceIcon)) {
  console.error(`Icone da instancia nao encontrado: ${sourceIcon}`);
  process.exit(1);
}

const powershellScript = String.raw`
param(
  [Parameter(Mandatory = $true)][string]$SourceIcon,
  [Parameter(Mandatory = $true)][string]$AndroidResDir
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Save-IconPng {
  param(
    [string]$Target,
    [int]$Width,
    [int]$Height,
    [double]$Ratio,
    [bool]$WhiteBackground
  )

  $source = [System.Drawing.Image]::FromFile($SourceIcon)
  try {
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        if ($WhiteBackground) {
          $graphics.Clear([System.Drawing.Color]::White)
        } else {
          $graphics.Clear([System.Drawing.Color]::Transparent)
        }

        $size = [Math]::Max(1, [int][Math]::Round([Math]::Min($Width, $Height) * $Ratio))
        $x = [int][Math]::Round(($Width - $size) / 2)
        $y = [int][Math]::Round(($Height - $size) / 2)
        $graphics.DrawImage($source, $x, $y, $size, $size)
      } finally {
        $graphics.Dispose()
      }

      $targetDir = Split-Path -Parent $Target
      if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir | Out-Null
      }
      $bitmap.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$launcherDensities = @(
  @{ Dir = 'mipmap-mdpi'; Size = 48; Foreground = 108 },
  @{ Dir = 'mipmap-hdpi'; Size = 72; Foreground = 162 },
  @{ Dir = 'mipmap-xhdpi'; Size = 96; Foreground = 216 },
  @{ Dir = 'mipmap-xxhdpi'; Size = 144; Foreground = 324 },
  @{ Dir = 'mipmap-xxxhdpi'; Size = 192; Foreground = 432 }
)

foreach ($density in $launcherDensities) {
  $dir = Join-Path $AndroidResDir $density.Dir
  Save-IconPng -Target (Join-Path $dir 'ic_launcher.png') -Width $density.Size -Height $density.Size -Ratio 1.0 -WhiteBackground $false
  Save-IconPng -Target (Join-Path $dir 'ic_launcher_round.png') -Width $density.Size -Height $density.Size -Ratio 1.0 -WhiteBackground $false
  Save-IconPng -Target (Join-Path $dir 'ic_launcher_foreground.png') -Width $density.Foreground -Height $density.Foreground -Ratio 0.72 -WhiteBackground $false
}

$splashTargets = @(
  @{ Dir = 'drawable'; Width = 480; Height = 320 },
  @{ Dir = 'drawable-land-mdpi'; Width = 480; Height = 320 },
  @{ Dir = 'drawable-land-hdpi'; Width = 800; Height = 480 },
  @{ Dir = 'drawable-land-xhdpi'; Width = 1280; Height = 720 },
  @{ Dir = 'drawable-land-xxhdpi'; Width = 1600; Height = 960 },
  @{ Dir = 'drawable-land-xxxhdpi'; Width = 1920; Height = 1280 },
  @{ Dir = 'drawable-port-mdpi'; Width = 320; Height = 480 },
  @{ Dir = 'drawable-port-hdpi'; Width = 480; Height = 800 },
  @{ Dir = 'drawable-port-xhdpi'; Width = 720; Height = 1280 },
  @{ Dir = 'drawable-port-xxhdpi'; Width = 960; Height = 1600 },
  @{ Dir = 'drawable-port-xxxhdpi'; Width = 1280; Height = 1920 }
)

foreach ($target in $splashTargets) {
  Save-IconPng -Target (Join-Path (Join-Path $AndroidResDir $target.Dir) 'splash.png') -Width $target.Width -Height $target.Height -Ratio 0.32 -WhiteBackground $true
}
`;

const scriptPath = path.join(os.tmpdir(), `sync-android-assets-${process.pid}.ps1`);
fs.writeFileSync(scriptPath, powershellScript);

try {
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-SourceIcon',
    sourceIcon,
    '-AndroidResDir',
    androidResDir
  ], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} finally {
  fs.rmSync(scriptPath, { force: true });
}

console.log(`Assets Android sincronizados: ${instance}`);
console.log(`Icone base: ${path.relative(projectRoot, sourceIcon)}`);
