import catalog from './content/places.json' with {type:'json'};
import facilityCatalog from './content/facilities.json' with {type:'json'};
export const places=catalog;
export const facilities=facilityCatalog;
export const allPlaces=[...places,...facilities];
export const byId=id=>allPlaces.find(p=>p.id===id);
export const placeholderImage='/assets/qixia-illustration.png';
export const mapLink=p=>p.location?`https://uri.amap.com/navigation?to=${p.location.join(',')},${encodeURIComponent(p.name)}&mode=walk&coordinate=gaode&src=qixia-guide&callnative=1`:`https://uri.amap.com/search?keyword=${encodeURIComponent('南京栖霞山 '+p.name)}`;
export const prompts=[{id:'autumn',text:'一起收集秋色',question:'两个人一起赏秋，有哪些景点值得看？'},{id:'mirror-lake',text:'湖边与古桥',question:'情侣来栖霞，推荐几个有故事的景点'},{id:'tea',text:'听一段茶与旧事',question:'我们想了解栖霞的茶事和题刻'},{id:'spring-bridge',text:'发现桥边故事',question:'给我们讲讲春雨桥与行宫的故事'}];
