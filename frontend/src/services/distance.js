export const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function distanceMeters(a,b){if(!validPoint(a)||!validPoint(b))return null;const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlng=(b[0]-a[0])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlng/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export const formatDistance=m=>Number.isFinite(m)?m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`:'';
export function nearby(items,position){if(!validPoint(position))return items;return [...items].sort((a,b)=>(distanceMeters(position,a.location)??Infinity)-(distanceMeters(position,b.location)??Infinity));}
