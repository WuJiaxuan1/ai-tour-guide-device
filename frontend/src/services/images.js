import manifest from '../content/image-variants.json' with {type:'json'};
export const imageVariant=(src,width=640)=>{const variants=manifest[src]?.variants;return variants?(variants.find(v=>v.width>=width)||variants.at(-1)).src:src;};
export function imageProps(src,sizes='(max-width: 700px) 100vw, 420px',width=640){
 const entry=manifest[src];return {src:imageVariant(src,width),...(entry?{srcSet:entry.variants.map(v=>`${v.src} ${v.width}w`).join(', '),width:entry.width,height:entry.height,sizes}:{}),decoding:'async'};
}
