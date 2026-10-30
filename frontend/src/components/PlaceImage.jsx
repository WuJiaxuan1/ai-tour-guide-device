import {useEffect,useState} from 'react';
import {imageProps} from '../services/images';
const placeholderImage='/assets/qixia-illustration.png';
export default function PlaceImage({place,loading='lazy',sizes='(max-width: 700px) 100vw, 420px',width=640,onFailure}){
 const [failed,setFailed]=useState(false),[fallbackFailed,setFallbackFailed]=useState(false);useEffect(()=>{setFailed(false);setFallbackFailed(false);},[place.id,place.image]);
 const illustration=failed||!place.image;
 return <>{fallbackFailed?<span className="image-unavailable">图片暂未加载</span>:<img {...imageProps(illustration?placeholderImage:place.image,sizes,width)} alt={illustration?'栖霞山主题示意插画':place.name} loading={loading} onError={()=>{onFailure?.();illustration?setFallbackFailed(true):setFailed(true);}}/>} {illustration&&<small className="illustration-tag">{failed?'照片暂未加载 · 示意插画':'示意插画'}</small>}</>;
}
