# LIENZO - ventana nativa de Windows.
# Muestra la app en un WebView2 (el runtime de Microsoft que trae Windows 11 y
# casi todo Windows 10) dentro de una ventana WinForms creada por PowerShell:
# sin navegador, sin compilar nada y sin ejecutables propios. Las DLLs del SDK
# las descarga scripts/fetch-webview2.js en <repo>\webview2.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File webview-win.ps1 -Url <url> [-Icon <ico>]
#
# Sale con codigo 1 ante cualquier fallo (SDK ausente, runtime ausente...) para
# que el lanzador (scripts/open.js) caiga automaticamente al modo navegador.

param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string]$Icon = ''
)

$ErrorActionPreference = 'Stop'
try {
  $root = Split-Path -Parent $PSScriptRoot
  $lib = Join-Path $root 'webview2'

  # WebView2Loader.dll se resuelve por PATH (DllImport no busca junto a la
  # DLL administrada): anteponer la carpeta del SDK.
  $env:PATH = $lib + ';' + $env:PATH

  Add-Type -Path (Join-Path $lib 'Microsoft.Web.WebView2.Core.dll')
  Add-Type -Path (Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll')
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  # Lanza excepcion si el runtime WebView2 no esta instalado en este Windows.
  $null = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString()

  [System.Windows.Forms.Application]::EnableVisualStyles()

  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'LIENZO'
  $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $form.Width = [Math]::Min(1480, [int]($wa.Width * 0.9))
  $form.Height = [Math]::Min(940, [int]($wa.Height * 0.92))
  $form.StartPosition = 'CenterScreen'
  if ($Icon -and (Test-Path $Icon)) {
    $form.Icon = New-Object System.Drawing.Icon($Icon)
  }

  $web = New-Object Microsoft.Web.WebView2.WinForms.WebView2
  $web.Dock = [System.Windows.Forms.DockStyle]::Fill

  # Carpeta de datos propia: sin ella WebView2 intenta escribir junto al
  # ejecutable anfitrion (powershell.exe, en System32) y falla.
  $props = New-Object Microsoft.Web.WebView2.WinForms.CoreWebView2CreationProperties
  $props.UserDataFolder = Join-Path $env:LOCALAPPDATA 'LIENZO\WebView2'
  $web.CreationProperties = $props
  $web.Source = [Uri]$Url

  $form.Controls.Add($web)
  [System.Windows.Forms.Application]::Run($form)
  exit 0
} catch {
  [Console]::Error.WriteLine('LIENZO webview: ' + $_.Exception.Message)
  exit 1
}
