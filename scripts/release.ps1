# ============================================================================
#  PC Dynamic Island - 一键构建并发布新版本到 GitHub Releases
#
#  用法：
#    1. 修改 package.json 里的 "version"（如 1.2.0）
#    2. 在项目根目录运行：
#         powershell -ExecutionPolicy Bypass -File scripts\release.ps1
#
#  前置条件：
#    - 已安装并登录 GitHub CLI（gh auth login）
#    - 已配置 package.json 的 build.publish（GitHub 源），用于生成 latest.yml
#
#  说明：脚本会自动处理连字符文件名（与 latest.yml 一致），
#        保证应用内 electron-updater 自动更新能正确下载。
# ============================================================================

$ErrorActionPreference = 'Stop'

# 切到项目根目录（脚本所在目录的上一级）
Set-Location (Split-Path -Parent $PSScriptRoot)

# ---------- 读取版本号 ----------
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$version = $pkg.version
if (-not $version) { throw '无法从 package.json 读取 version 字段' }
$tag = "v$version"

Write-Host ''
Write-Host '===== PC Dynamic Island 发布脚本 =====' -ForegroundColor Cyan
Write-Host "版本: $version    tag: $tag" -ForegroundColor Yellow
Write-Host ''

# ---------- 检查 gh 登录 ----------
Write-Host '[0/4] 检查 GitHub CLI 登录状态 ...' -ForegroundColor Cyan
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'GitHub CLI 未登录，请先运行: gh auth login' -ForegroundColor Red
  exit 1
}

# ---------- 1. 构建 + 打包 ----------
Write-Host "[1/4] 构建并打包 v$version ..." -ForegroundColor Cyan
npm run dist
if ($LASTEXITCODE -ne 0) { throw '打包失败，请查看上方错误信息' }

# ---------- 2. 准备发布文件 ----------
$exeSpace  = "release\PC Dynamic Island Setup $version.exe"
$exeSafe   = "release\PC-Dynamic-Island-Setup-$version.exe"
$mapSpace  = "$exeSpace.blockmap"
$mapSafe   = "$exeSafe.blockmap"
$latestYml = 'release\latest.yml'

if (-not (Test-Path $exeSpace)) { throw "找不到安装包: $exeSpace" }
if (-not (Test-Path $latestYml)) { throw '找不到 latest.yml（请确认 package.json 已配置 build.publish）' }

Write-Host '[2/4] 准备连字符文件名（与 latest.yml 保持一致）...' -ForegroundColor Cyan
Copy-Item $exeSpace $exeSafe -Force
Copy-Item $mapSpace $mapSafe -Force

# ---------- 3. 检查 Release 是否已存在 ----------
Write-Host "[3/4] 检查 GitHub 上是否已存在 $tag ..." -ForegroundColor Cyan
if (gh release view $tag *> $null) {
  Write-Host "警告: Release $tag 已存在！" -ForegroundColor Yellow
  Write-Host "  如需更新资产:      gh release upload $tag $exeSafe $mapSafe $latestYml --clobber"
  Write-Host "  如需删除后重建:    gh release delete $tag --yes"
  exit 1
}

# ---------- 4. 发布 ----------
Write-Host "[4/4] 发布 $tag 到 GitHub ..." -ForegroundColor Cyan
gh release create $tag $exeSafe $mapSafe $latestYml --title $tag --notes "PC Dynamic Island $version"
if ($LASTEXITCODE -ne 0) { throw '发布失败，请查看上方错误信息' }

# ---------- 完成 ----------
Write-Host ''
Write-Host "===== 发布成功 =====" -ForegroundColor Green
Write-Host "Release 页面: https://github.com/WDream-BYZM/PC-Dynamic-Island/releases/tag/$tag"
Write-Host "下载最新版:  https://github.com/WDream-BYZM/PC-Dynamic-Island/releases/latest/download/PC-Dynamic-Island-Setup-$version.exe"
Write-Host ''
Write-Host '提示：记得把代码改动一起推送到 GitHub（git add -A; git commit -m "..."; git push）' -ForegroundColor DarkGray
