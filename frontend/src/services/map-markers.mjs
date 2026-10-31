import {visitKey} from '../../../shared/routes.mjs';

export function routeMapStops(stops) {
  return stops.map((stop,i)=>({...stop,id:visitKey(stop),endpoint:i===0?'start':i===stops.length-1?'end':null})).filter(s=>Array.isArray(s.location));
}

export function endpointOffset(point,points) {
  if(!point.endpoint)return [0,0];
  const overlaps=points.some(other=>other.id!==point.id&&other.endpoint&&other.location.every((v,i)=>Math.abs(v-point.location[i])<1e-7));
  return overlaps?[point.endpoint==='start'?-18:18,0]:[0,0];
}

export function addEndpointIcon(button,role) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  const paths=role==='start'?['M5 12h14','m12 5 7 7-7 7']:['M4 22V3','M4 3c4-3 8 3 12 0v10c-4 3-8-3-12 0'];
  for(const d of paths){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.append(path);}
  button.append(svg);
}
