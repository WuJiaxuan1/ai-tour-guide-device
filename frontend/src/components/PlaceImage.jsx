import {useEffect,useState} from 'react';
import {placeholderImage} from '../data';
export default function PlaceImage({place,loading='lazy'}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[place.id,place.image]);
 const illustration=failed||!place.image;
 return <><img src={illustration?placeholderImage:place.image} alt={illustration?'栖霞山主题示意插画':place.name} loading={loading} onError={()=>{if(!illustration)setFailed(true)}}/>{illustration&&<small className="illustration-tag">示意插画</small>}</>;
}
