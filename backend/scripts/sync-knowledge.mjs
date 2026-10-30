import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {loadKnowledge} from '../src/knowledge.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');const kb=loadKnowledge(root);
writeFileSync(resolve(root,'frontend/src/content/knowledge.json'),JSON.stringify({version:kb.version,pois:kb.pois},null,2)+'\n');
console.log(`Synced ${kb.pois.length} public knowledge entries; private source references excluded.`);
