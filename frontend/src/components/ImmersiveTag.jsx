import {TEMPLE_EXPERIENCE,hasTempleExperience} from '../../../shared/immersive.mjs';
export default function ImmersiveTag({placeId,route,onOpen}){
 if(placeId!=='temple'&&!hasTempleExperience(route))return null;
 return <button type="button" className="immersive-tag" aria-label="栖霞寺沉浸式体验" onClick={e=>{e.stopPropagation();onOpen(TEMPLE_EXPERIENCE.id);}}>沉浸式体验</button>;
}
