import catalog from './content/places.json' with {type:'json'};
export const places=catalog;
export const byId=id=>places.find(p=>p.id===id);
export const prompts=[{id:'autumn',text:'一起收集秋色',question:'两个人想一起赏秋，有哪些景点值得慢慢看？'},{id:'mirror-lake',text:'两个人，慢慢逛',question:'情侣来栖霞，想两个人慢慢走，推荐几个有故事的地方'},{id:'tea',text:'听一段茶与旧事',question:'我们想一起了解栖霞的茶事和题刻'},{id:'spring-bridge',text:'桥边停一停',question:'给我们讲讲春雨桥与行宫的故事'}];
