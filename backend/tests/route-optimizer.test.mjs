import test from 'node:test';import assert from 'node:assert/strict';import {shortestOrder} from '../src/route-optimizer.mjs';
test('directed road costs, fixed start and return legs determine the optimum',()=>{
 const matrix=[[0,9,1,7],[7,0,2,1],[9,1,0,8],[1,7,2,0]];
 assert.deepEqual(shortestOrder(matrix).order,[0,2,1,3]);assert.equal(shortestOrder(matrix).distanceMeters,3);
 assert.equal(shortestOrder(matrix,{returnToStart:true}).distanceMeters,4);
});
test('agrees with exhaustive road-distance permutations including disconnected directions',()=>{
 function permutations(a){return a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[v,...t])):[[]];}
 const matrices=[[[0,10,2],[1,0,20],[8,1,0]],[[0,Infinity,5],[3,0,7],[8,2,0]]];
 for(const matrix of matrices)for(const round of[false,true]){const best=Math.min(...permutations([1,2]).map(t=>{const o=[0,...t];let c=0;for(let i=1;i<o.length;i++)c+=matrix[o[i-1]][o[i]];return c+(round?matrix[o.at(-1)][0]:0);}));assert.equal(shortestOrder(matrix,{returnToStart:round}).distanceMeters,best);}
 assert.throws(()=>shortestOrder([[0,Infinity],[Infinity,0]]),/步行连接/);
});
