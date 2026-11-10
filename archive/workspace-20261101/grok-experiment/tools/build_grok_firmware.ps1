param([string]$Action='build')
$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$env:IDF_PATH=Join-Path $taskRoot 'esp-idf-v5.5.2'
$env:IDF_TOOLS_PATH=Join-Path $taskRoot '.tools\espressif'
$env:IDF_PYTHON_ENV_PATH=Join-Path $env:IDF_TOOLS_PATH 'python_env\idf5.5_py3.12_env'
$env:IDF_COMPONENT_CACHE_PATH=Join-Path $taskRoot '.tools\component-cache'
$env:PIP_CACHE_DIR=Join-Path $taskRoot '.tools\pip-cache'
$env:PIP_INDEX_URL='https://pypi.tuna.tsinghua.edu.cn/simple'
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='http.sslBackend'
$env:GIT_CONFIG_VALUE_0='openssl'
$env:IDF_TARGET='esp32s3'
$env:PYTHONUTF8='1'
$env:ESP_ROM_ELF_DIR=Join-Path $env:IDF_TOOLS_PATH 'tools\esp-rom-elfs\20241011'
$env:PATH=(Join-Path $env:IDF_PYTHON_ENV_PATH 'Scripts')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\xtensa-esp-elf\esp-14.2.0_20251107\xtensa-esp-elf\bin')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\cmake\3.30.2\bin')+';'+(Join-Path $env:IDF_TOOLS_PATH 'tools\ninja\1.12.1')+';'+$env:PATH
Push-Location (Join-Path $taskRoot 'firmware-source')
try {
    & (Join-Path $env:IDF_PYTHON_ENV_PATH 'Scripts\python.exe') (Join-Path $env:IDF_PATH 'tools\idf.py') '-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.grok' $Action
    if($LASTEXITCODE -ne 0){throw "ESP-IDF $Action failed: $LASTEXITCODE"}
} finally {Pop-Location}
