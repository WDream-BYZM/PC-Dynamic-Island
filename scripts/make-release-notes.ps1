# ============================================================================
#  从 CHANGELOG.md 提取指定版本的更新内容，生成 GitHub Release 说明文件
#
#  用法：
#    powershell -ExecutionPolicy Bypass -File scripts\make-release-notes.ps1 -Version 1.4.0
#
#  输出：
#    release\release-notes-<version>.md
#
#  说明：
#    - 自动拼上中英双语项目简介（与 v1.0.0 的 Release 风格一致）
#    - 更新内容直接从 CHANGELOG.md 对应版本块提取，无需手写
# ============================================================================

param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path 'CHANGELOG.md')) { throw '找不到 CHANGELOG.md' }

$notesFile = "release\release-notes-$Version.md"

$notes = New-Object System.Collections.Generic.List[string]
$notes.Add("## PC Dynamic Island v$Version")
$notes.Add("")
$notes.Add('在 Windows 上复刻苹果灵动岛（Dynamic Island），将通知、音乐、系统状态等融合进一块微型悬浮面板。')
$notes.Add("Recreate Apple's Dynamic Island on Windows - a mini floating panel for notifications, music, and system status.")
$notes.Add("")
$notes.Add("### 更新内容 / What's New")
$notes.Add("")

# 定位当前版本块：从 "## [x.y.z]" 开始，到下一个 "## [" 结束
$inBlock = $false
foreach ($line in (Get-Content 'CHANGELOG.md')) {
  if ($line -match '^##\s+\[') {
    if ($inBlock) { break }
    if ($line -match ("\[" + [regex]::Escape($Version) + "\]")) { $inBlock = $true }
    continue
  }
  if ($inBlock -and $line.Trim() -ne '') { $notes.Add($line) }
}

if (-not $inBlock) { throw "CHANGELOG.md 中找不到版本 [$Version] 的条目" }

$notes.Add("")
$notes.Add("完整更新日志见 [CHANGELOG.md](https://github.com/WDream-BYZM/PC-Dynamic-Island/blob/main/CHANGELOG.md)")

($notes -join "`n") | Set-Content -Path $notesFile -Encoding UTF8
Write-Host "Release Notes 已生成: $notesFile" -ForegroundColor Green
