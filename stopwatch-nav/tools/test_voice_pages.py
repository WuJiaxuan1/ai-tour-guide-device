"""Compile actual app/audio methods with desktop hardware shims and exercise page changes."""
from pathlib import Path
import os
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / "tests/build/p5-voice"
out.mkdir(parents=True, exist_ok=True)

def method(text, signature):
    start = text.index(signature)
    opening = text.index("{", start)
    depth = 0
    for i in range(opening, len(text)):
        if text[i] == "{": depth += 1
        elif text[i] == "}":
            depth -= 1
            if not depth: return text[start:i+1] + "\n"
    raise ValueError("Unbalanced method")

app = (root / "firmware/main/application.cc").read_text("utf-8")
audio = (root / "firmware/main/audio/audio_service.cc").read_text("utf-8")
(out / "app_methods.inc").write_text("\n".join(method(app, s) for s in [
    "bool Application::SetVoicePaused(", "void Application::ScheduleVoice(",
    "void Application::HandleStateChangedEvent()"]), encoding="utf-8")
(out / "audio_methods.inc").write_text("\n".join(method(audio, s) for s in [
    "void AudioService::SetSuspended(", "void AudioService::ResetDecoder()",
    "void AudioService::PushTaskToEncodeQueue(", "bool AudioService::PushPacketToDecodeQueue("]), encoding="utf-8")
start = app.index("    audio_service_.Initialize(codec);")
end = app.index("    audio_service_.Start();", start) + len("    audio_service_.Start();")
(out / "boot_volume.inc").write_text(app[start:end], encoding="utf-8")
compiler = Path("D:/Apps/mingw64/bin")
env = os.environ.copy()
env["PATH"] = str(compiler) + os.pathsep + env["PATH"]
subprocess.run([str(x) for x in [compiler / "g++.exe", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-Wno-sign-compare",
    "-I", root / "firmware/main/audio", "-I", out, root / "tests/p5host/voice_test.cc", "-o", out / "voice_test.exe"]], env=env, check=True)
subprocess.run([str(out / "voice_test.exe")], env=env, check=True)
