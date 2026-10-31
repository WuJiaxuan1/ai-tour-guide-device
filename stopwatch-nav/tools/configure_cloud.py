"""Maintainer-only: change server origin for local testing; visitors use voice pairing."""
import argparse, ipaddress, json, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlsplit

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--config',type=Path,help='Optional legacy cloud01 export')
parser.add_argument('--watch-ip',required=True)
parser.add_argument('--server-url',help='HTTPS origin or PC LAN URL for local testing')
args=parser.parse_args()
try:
    watch=ipaddress.IPv4Address(args.watch_ip)
    if not watch.is_private or watch.is_loopback:raise ValueError('Use the watch LAN IPv4 address')
    value=json.loads(args.config.read_text(encoding='utf-8-sig')) if args.config else {}
    if not args.server_url and not value:raise ValueError('Provide a server URL')
    origin=(args.server_url or value['server_url']).rstrip('/')
    url=urlsplit(origin)
    if url.path or url.query or url.fragment or url.username or url.password:raise ValueError('Server URL must be an origin without path or user information')
    if url.scheme!='https':
        host=ipaddress.IPv4Address(url.hostname)
        if url.scheme!='http' or not host.is_private or host.is_loopback:raise ValueError('Use HTTPS or a LAN IPv4 URL; localhost cannot be reached by the watch')
    body=json.dumps({k:v for k,v in dict(server_url=origin,trip_id=value.get('trip_id',''),token=value.get('token','')).items()}).encode()
    if len(body)>384:raise ValueError('Configuration exceeds watch limit')
    endpoint=f'http://{watch}:8765'
    status=json.load(urllib.request.urlopen(endpoint+'/api/v1/status',timeout=5))
    if status.get('cloud_protocol')!=1:raise ValueError('Install P9 cloud firmware first')
    req=urllib.request.Request(endpoint+'/api/v1/cloud',data=body,headers={'Content-Type':'application/json'},method='POST')
    result=json.load(urllib.request.urlopen(req,timeout=10))
    if not result.get('configured'):raise ValueError('Watch did not confirm configuration')
    print('Configured server origin. Ask the watch for a pairing code and enter it on the webpage.')
except (ValueError,KeyError,OSError,urllib.error.URLError) as e:
    # HTTP errors can include credentials in arbitrary response bodies: do not print them.
    print('Configuration failed. Check firmware, server origin, LAN addresses and connectivity.');raise SystemExit(1)
