"""Compile real wake/page transition methods against deterministic transport/model shims."""
from pathlib import Path
import argparse
import os
import subprocess

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--app-source', type=Path, default=root/'firmware/main/application.cc')
parser.add_argument('--wake-source', type=Path, default=root/'firmware/main/audio/wake_words/custom_wake_word.cc')
args = parser.parse_args()
out = root/'tests/build/wake-recovery'
out.mkdir(parents=True, exist_ok=True)

def method(text, signature):
    start = text.index(signature)
    opening = text.index('{', start)
    depth = 0
    for i in range(opening, len(text)):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if not depth: return text[start:i+1]+'\n'
    raise ValueError(signature)

app = args.app_source.read_text('utf-8')
wake = args.wake_source.read_text('utf-8')
(out/'wake_app.inc').write_text('\n'.join(method(app, s) for s in (
    'void Application::HandleWakeWordDetectedEvent()',
    'void Application::ContinueWakeWordInvoke(',
    'void Application::ContinueOpenAudioChannel(',
    'void Application::WakeWordInvoke(',
    'void Application::HandleStateChangedEvent()',
    'bool Application::SetVoicePaused(',
    'void Application::SetListeningMode(')), encoding='utf-8')
(out/'wake_model.inc').write_text('\n'.join(method(wake, s) for s in (
    'void CustomWakeWord::Start()', 'void CustomWakeWord::Stop()')), encoding='utf-8')
compiler = Path('D:/Apps/mingw64/bin')
env = os.environ.copy()
env['PATH'] = str(compiler)+os.pathsep+env['PATH']
subprocess.run([str(x) for x in (compiler/'g++.exe', '-std=c++17', '-Wall', '-Wextra', '-Werror',
    '-I', root/'firmware/main', '-I', root/'firmware/main/audio', '-I', out,
    root/'tests/p5host/wake_recovery_test.cc', '-o', out/'wake_recovery_test.exe')], env=env, check=True)
subprocess.run([str(out/'wake_recovery_test.exe')], env=env, check=True)
