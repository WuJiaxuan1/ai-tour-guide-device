param(
    [ValidateSet('firmware','android')][string]$Target,
    [switch]$Offline,
    [switch]$Test
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$workspaceRoot=Split-Path $projectRoot -Parent
if ($Target -eq 'firmware') {
    $toolRoot=Join-Path $workspaceRoot 'stopwatch-custom'
    $env:IDF_PATH=Join-Path $toolRoot 'esp-idf-v5.5.2'
    $env:IDF_TOOLS_PATH=Join-Path $toolRoot '.tools\espressif'
    $env:IDF_PYTHON_ENV_PATH=Join-Path $env:IDF_TOOLS_PATH 'python_env\idf5.5_py3.12_env'
    $env:IDF_COMPONENT_CACHE_PATH=Join-Path $toolRoot '.tools\component-cache'
    $env:IDF_TARGET='esp32s3'
    $env:PYTHONUTF8='1'
    $env:ESP_ROM_ELF_DIR=Join-Path $env:IDF_TOOLS_PATH 'tools\esp-rom-elfs\20241011'
    $env:PATH=(Join-Path $env:IDF_PYTHON_ENV_PATH 'Scripts')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\xtensa-esp-elf\esp-14.2.0_20251107\xtensa-esp-elf\bin')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\cmake\3.30.2\bin')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\ninja\1.12.1')+';'+$env:PATH
    Push-Location (Join-Path $projectRoot 'firmware')
    try {
        & (Join-Path $env:IDF_PYTHON_ENV_PATH 'Scripts\python.exe') (Join-Path $env:IDF_PATH 'tools\idf.py') '-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.stopwatch' '-DBOARD_NAME=m5stack-stopwatch' build
        if ($LASTEXITCODE -ne 0) { throw "Firmware build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
} elseif ($Target -eq 'android') {
    $toolRoot=Join-Path $workspaceRoot 'MotoNav-main\.tools'
    $env:JAVA_HOME=Join-Path $toolRoot 'jdk\jdk-21.0.12.1+1'
    $env:ANDROID_HOME=Join-Path $toolRoot 'android-sdk'
    $env:GRADLE_USER_HOME=Join-Path $toolRoot 'gradle-cache'
    $env:PATH=(Join-Path $env:JAVA_HOME 'bin')+';'+$env:PATH
    Push-Location (Join-Path $projectRoot 'android')
    try {
        $gradleArgs=@('--no-daemon','--console=plain',':app:assembleDebug')
        if ($Test) { $gradleArgs+= ':app:testDebugUnitTest' }
        if ($Offline) { $gradleArgs+= '--offline' }
        & .\gradlew.bat @gradleArgs
        if ($LASTEXITCODE -ne 0) { throw "Android build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
} else {
    throw 'Specify -Target firmware or -Target android. This script never flashes or installs.'
}
