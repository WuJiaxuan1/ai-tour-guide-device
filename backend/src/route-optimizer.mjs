import {ServiceError} from './amap.mjs';
// Held–Karp on a directed walking-distance matrix, with the first stop fixed.
export function shortestOrder(matrix,{returnToStart=false}={}){
 const n=matrix.length;if(n<2||n>8||matrix.some(row=>row.length!==n))throw new ServiceError('请选择2至8个地点。',400);
 const size=1<<n,dp=Array.from({length:size},()=>Array(n).fill(Infinity)),prev=Array.from({length:size},()=>Array(n).fill(-1));dp[1][0]=0;
 for(let mask=1;mask<size;mask+=2)for(let end=0;end<n;end++)if(Number.isFinite(dp[mask][end]))for(let next=1;next<n;next++){
  if(mask&(1<<next))continue;const cost=matrix[end][next];if(!Number.isFinite(cost)||cost<0)continue;
  const m=mask|(1<<next),value=dp[mask][end]+cost;if(value<dp[m][next]){dp[m][next]=value;prev[m][next]=end;}
 }
 let end=-1,best=Infinity;for(let j=1;j<n;j++){const cost=dp[size-1][j]+(returnToStart?matrix[j][0]:0);if(cost<best){best=cost;end=j;}}
 if(end<0)throw new ServiceError('所选地点之间没有完整的步行连接，请调整地点。',422);
 const order=[];let mask=size-1;while(end>=0){order.push(end);const parent=prev[mask][end];mask^=1<<end;end=parent;}order.reverse();return{order,distanceMeters:best};
}
