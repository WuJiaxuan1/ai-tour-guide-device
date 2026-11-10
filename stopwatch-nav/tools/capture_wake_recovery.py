"""Read only wake lifecycle diagnostic lines; never flash or intentionally reset a device."""
import argparse
from datetime import datetime
from pathlib import Path
import re
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', required=True, help='Device COM port, e.g. COM3')
    parser.add_argument('--seconds', type=int, default=60)
    args = parser.parse_args()
    if not 5 <= args.seconds <= 120:
        parser.error('--seconds must be between 5 and 120')
    import serial
    root = Path(__file__).resolve().parents[1]
    # A copy in releases/STAGE keeps logs alongside the package instead.
    if (Path(__file__).parent / 'build-report.json').exists():
        root = Path(__file__).parent
    output = root / 'logs' / ('wake-recovery-device-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.log')
    port = serial.Serial(port=None, baudrate=115200, timeout=.3)
    # Do not deliberately pulse the ESP32 reset/boot lines.
    port.dtr = False
    port.rts = False
    port.port = args.port
    try:
        port.open()
        output.parent.mkdir(parents=True, exist_ok=True)
        print(f'Collecting {args.seconds}s. Say the wake word, finish a conversation, then switch to map and back; say it again.', flush=True)
        print('Only wake/state diagnostic lines are saved; chat transcripts are excluded. No flash/write commands are sent.', flush=True)
        count = 0
        until = time.monotonic() + args.seconds
        with output.open('w', encoding='utf-8') as stream:
            while time.monotonic() < until:
                line = port.readline(4096).decode('utf-8', errors='replace').strip()
                line = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', line)
                if any(marker in line for marker in (
                    'WakeRecovery:', 'Custom wake word detected:',
                    'Wake word detected:', 'StateMachine: State:',
                    'Voice page paused', 'Voice page resumed',
                    'Left key: start voice conversation',
                    'Failed to initialize wake word',
                    'Failed to initialize multinet',
                    'Encode wake word opus', 'Failed to create audio encoder')):
                    print(line, flush=True)
                    stream.write(line + '\n')
                    count += 1
        print(f'Saved {count} diagnostic lines: {output}')
        if not count:
            print('No diagnostic lines received. Check the port and running firmware; this does not prove a microphone or recognition fault.')
    except serial.SerialException as error:
        print(f'Cannot read serial port: {error}', file=sys.stderr)
        return 1
    finally:
        port.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
