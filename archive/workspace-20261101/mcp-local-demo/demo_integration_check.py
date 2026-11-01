"""Exercise real HTTP -> disk -> stdio MCP locally, in an isolated temporary demo."""
import asyncio
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent / 'ai-tour-guide-device'

async def main():
    (PROJECT / '.local-work').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='demo-integration-', dir=PROJECT / '.local-work') as directory:
        env = dict(os.environ, QIXIA_DEMO_ENABLED='1', PORT='0',
                   QIXIA_DEMO_READ_TOKEN=secrets.token_hex(32), DEMO_TRIP_PATH=str(Path(directory)/'trip.json'))
        process = subprocess.Popen(['node', str(PROJECT/'backend/src/server.mjs')], cwd=PROJECT,
                                   env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
        try:
            line = process.stdout.readline()
            match = re.search(r'127[.]0[.]0[.]1:([0-9]+)', line)
            if not match:
                raise RuntimeError('Test backend failed to start')
            base = 'http://127.0.0.1:' + match.group(1)
            owner = secrets.token_hex(32)
            reader = env['QIXIA_DEMO_READ_TOKEN']
            opener = build_opener(ProxyHandler({}))
            def call(path, data=None, token=owner, origin='http://127.0.0.1:5173'):
                headers = {'X-Qixia-Demo': '1', 'Origin': origin}
                if token: headers['Authorization'] = 'Bearer ' + token
                if data is not None: headers['Content-Type'] = 'application/json'
                request = Request(base+'/api/demo-trip/'+path, headers=headers,
                                  data=None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8'))
                try:
                    with opener.open(request, timeout=5) as response:
                        return response.status, json.loads(response.read())
                except HTTPError as error:
                    return error.code, json.loads(error.read())
            assert call('current', token=None)[0] == 401
            assert call('current', token=owner)[0] == 401
            assert call('start', {'selectedPlaces': []}, origin='https://unrelated.example')[0] == 403
            assert call('current', token=reader)[1]['active'] is False
            child_env = dict(os.environ, PYTHONIOENCODING='utf-8', QIXIA_DEMO_API=base+'/api/demo-trip/current', QIXIA_DEMO_READ_TOKEN=reader)
            child_env.pop('MCP_ENDPOINT', None)
            params = StdioServerParameters(command=sys.executable, args=[str(ROOT/'qixia_tools.py')], env=child_env)
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as client:
                    await client.initialize()
                    assert 'get_current_qixia_demo_trip' in {t.name for t in (await client.list_tools()).tools}
                    async def query():
                        result = await client.call_tool('get_current_qixia_demo_trip', {})
                        assert not result.isError
                        return result.structuredContent or json.loads(result.content[0].text)
                    assert (await query())['active'] is False
                    snapshot = {'selectedPlaces': [{'id': 'mirror-lake'}, {'id': 'pagoda'}],
                                'entryId': 'gate', 'exitId': 'gate', 'stayMinutes': {'pagoda': 30},
                                'focusedPlaceId': 'pagoda',
                                'recentQuestions': ['我' * 2000, '景' * 2000, '我想听舍利塔的故事' + '景' * 1990]}
                    status, data = call('start', snapshot)
                    assert status == 201
                    trip = data['trip']
                    assert call('start', snapshot)[1]['trip']['id'] == trip['id']
                    assert call('start', snapshot, token=secrets.token_hex(32))[0] == 409
                    assert call('session', token=secrets.token_hex(32))[0] == 401
                    result = await query()
                    assert [p['id'] for p in result['selectedPlaces']] == ['mirror-lake', 'pagoda']
                    assert result['recentQuestions'] == snapshot['recentQuestions']
                    assert result['stayMinutes']['pagoda'] == 30
                    assert not result['locationAvailable']
                    snapshot['selectedPlaces'] = [{'id': 'pagoda'}]
                    status, data = call('update', dict(snapshot, expectedRevision=1))
                    assert status == 200 and data['trip']['revision'] == 2
                    assert call('update', dict(snapshot, expectedRevision=1))[0] == 409
                    assert [p['id'] for p in (await query())['selectedPlaces']] == ['pagoda']
                    guide = await client.call_tool('get_attraction_guide', {'place_name': 'pagoda'})
                    assert not guide.isError
                    assert call('end', {})[0] == 200
                    assert (await query())['active'] is False
                    assert call('update', dict(snapshot, expectedRevision=2))[0] == 404
                    assert 'pagoda' not in (Path(directory)/'trip.json').read_text(encoding='utf-8')
                    print('PASS: real HTTP + persistence + MCP selection, questions, removal, ownership, expiry boundaries and end cleanup.')
        finally:
            process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill(); process.wait()

if __name__ == '__main__':
    asyncio.run(main())
