import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Expand, X} from 'lucide-react';
import PlaceImage from './PlaceImage';
import './image-feedback.css';

export default function PlaceGallery({place}) {
  const [index, setIndex] = useState(0), [large, setLarge] = useState(false);
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const strip = useRef(null), dialog = useRef(null);
  const images = place.images || (place.image ? [place.image] : []);
  useEffect(() => {setIndex(0);strip.current?.scrollTo({left:0});setLarge(false);setFailed(false);setAttempt(0);}, [place.id]);
  useEffect(() => {if (large) dialog.current?.showModal();else dialog.current?.close();}, [large]);
  const go = next => {const i = (next + images.length) % images.length;setIndex(i);strip.current?.scrollTo({left:i * strip.current.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
  if (!images.length) return <div className="place-gallery placeholder-gallery"><PlaceImage place={place} loading="eager"/></div>;
  return <div className="place-gallery">
    {failed&&<button className="gallery-retry" onClick={()=>{setIndex(0);setAttempt(v=>v+1);setFailed(false);}}>照片加载失败，点击重试</button>}
    <div className="gallery-strip" key={attempt} ref={strip} onScroll={e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
      {images.map((url,i) => <button className="gallery-slide" key={url} onClick={() => {setIndex(i);setLarge(true);}} aria-label={`放大${place.name}第${i+1}张照片`}><PlaceImage onFailure={()=>setFailed(true)} place={{...place,image:url}} sizes="(max-width: 700px) 100vw, 680px" loading={i===0?'eager':'lazy'}/></button>)}
    </div>
    <span className="gallery-count">{index+1} / {images.length}</span>{images[index]?.startsWith('/assets/amap/')&&<span className="gallery-credit">图片：高德地图</span>}
    <button className="gallery-expand" onClick={() => setLarge(true)} aria-label="查看大图"><Expand size={16}/></button>
    {images.length>1 && <div className="gallery-dots">{images.map((url,i) => <button key={url} className={i===index?'active':''} aria-label={`查看第${i+1}张照片`} aria-current={i===index?'true':undefined} onClick={() => go(i)}/>)}</div>}
    <dialog className="photo-lightbox" ref={dialog} onCancel={() => setLarge(false)} onClose={() => setLarge(false)}>
      <button className="lightbox-close" onClick={() => setLarge(false)} aria-label="关闭大图"><X/></button>
      {failed&&<button className="gallery-retry" onClick={()=>{setAttempt(v=>v+1);setFailed(false);}}>照片加载失败，点击重试</button>}
      {large&&<PlaceImage key={images[index]+attempt} onFailure={()=>setFailed(true)} place={{...place,image:images[index]}} width={1280} sizes="100vw" loading="eager"/>}<p>{place.name} · {index+1}/{images.length}</p>
      {images.length>1 && <><button className="lightbox-prev" aria-label="上一张" onClick={() => go(index-1)}><ChevronLeft/></button><button className="lightbox-next" aria-label="下一张" onClick={() => go(index+1)}><ChevronRight/></button></>}
    </dialog>
  </div>;
}
