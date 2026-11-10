import {amapRequest} from '../amap.mjs';

// Only provider facts are used for location answers; no model invents an address.
export function createReverseGeocoder({key,request=amapRequest}) {
  return async location=>{
    const data=await request('/v3/geocode/regeo',{location:location.map(n=>n.toFixed(6)).join(','),extensions:'base',radius:100},key(),{signal:AbortSignal.timeout(6000)});
    const address=data.regeocode?.formatted_address;
    if(typeof address!=='string'||!address.trim()||address.length>300)return null;
    return {formatted_address:address.trim(),provider:'amap'};
  };
}

export function currentLocationReply(nav) {
  if(!nav)return '请先在网页选择路线、开始游览并连接小智，然后开启手机定位。';
  if(nav.location.freshness==='low_accuracy')return '手机定位精度不足，暂不能可靠判断当前位置。请到信号较好的地方，在网页重新定位。';
  if(nav.location.freshness==='stale')return '手机位置已过期，不能作为当前位置。请把网页切回前台并重新定位。';
  if(nav.location.freshness!=='fresh')return '当前还没有手机定位。请允许网页访问位置，并保持游览网页在前台打开。';
  if(nav.current_place?.name)return `定位显示你已接近${nav.current_place.name}，这尚不是确认到访。`;
  if(nav.location.address?.status==='resolved')return `根据手机定位，高德返回你当前大约在${nav.location.address.formatted_address}附近。这是位置参考，不代表已到访路线景点。`;
  return '已收到手机位置，但暂时无法查询附近地址，也未确认接近路线景点。请稍后重试。';
}
