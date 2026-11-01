// Credentials are read from an ignored local file, never from command-line args.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runBridge,loadBridgeEnv} from './mcp_pipe.mjs';
const env=loadBridgeEnv();
// Standard environment works after cloning; retain the old private-file fallback.
if(!env.MCP_ENDPOINT){
 try{env.MCP_ENDPOINT=JSON.parse(readFileSync(new URL('../../../.local-work/local-knowledge/endpoint.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')).endpoint;}
 catch{console.error('请在本机 .env.local 或进程环境中配置 MCP_ENDPOINT。');process.exit(2);}
}
const bridge=runBridge({env,command:[process.execPath,fileURLToPath(new URL('./knowledge-stdio.mjs',import.meta.url))]});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>bridge?.stop());
