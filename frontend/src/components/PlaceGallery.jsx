import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Expand, X} from 'lucide-react';
import PlaceImage from './PlaceImage';

export default function PlaceGallery({place}) {
  const [index, setIndex] = useState(0), [large, setLarge] = useState(false);
  const strip = useRef(null), dialog = useRef(null);
  const images = place.images || (place.image ? [place.image] : []);
  useEffect(() => {setIndex(0);strip.current?.scrollTo({left:0});setLarge(false);}, [place.id]);
  useEffect(() => {if (large) dialog.current?.showModal();else dialog.current?.close();}, [large]);
  const go = next => {const i = (next + images.length) % images.length;setIndex(i);strip.current?.scrollTo({left:i * strip.current.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
  if (!images.length) return <div className="place-gallery placeholder-gallery"><PlaceImage place={place} loading="eager"/></div>;
  return <div className="place-gallery">
    <div className="gallery-strip" ref={strip} onScroll={e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
      {images.map((url,i) => <button className="gallery-slide" key={url} onClick={() => setLarge(true)} aria-label={`放大${place.name}第${i+1}张照片`}><img src={url} alt={`${place.name} · 照片${i+1}`} loading={i===0?'eager':'lazy'}/></button>)}
    </div>
    <span className="gallery-count">{index+1} / {images.length}</span>{images[index]?.startsWith('/assets/amap/')&&<span className="gallery-credit">图片：高德地图</span>}
    <button className="gallery-expand" onClick={() => setLarge(true)} aria-label="查看大图"><Expand size={16}/></button>
    {images.length>1 && <div className="gallery-dots">{images.map((url,i) => <button key={url} className={i===index?'active':''} aria-label={`查看第${i+1}张照片`} aria-current={i===index?'true':undefined} onClick={() => go(i)}/>)}</div>}
    <dialog className="photo-lightbox" ref={dialog} onCancel={() => setLarge(false)} onClose={() => setLarge(false)}>
      <button className="lightbox-close" onClick={() => setLarge(false)} aria-label="关闭大图"><X/></button>
      <img src={images[index]} alt={place.name}/><p>{place.name} · {index+1}/{images.length}</p>
      {images.length>1 && <><button className="lightbox-prev" aria-label="上一张" onClick={() => go(index-1)}><ChevronLeft/></button><button className="lightbox-next" aria-label="下一张" onClick={() => go(index+1)}><ChevronRight/></button></>}
    </dialog>
  </div>;
}
