import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUp, ChevronDown, ChevronUp, Footprints, MapPin, Plus, X, LoaderCircle, Map as MapIcon} from 'lucide-react';
import {byId} from '../../data';
import {loadNavigationPlaces, planWalkingRoute} from '../../services/navigation';
import NavigationMap from '../../components/NavigationMap';
import './navigation.css';

const distance = meters => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

export default function RoutePage({route, setRoute, onExplore, onDetail, onIllustration}) {
  const [selected, setSelected] = useState(route[0] || null), [expanded, setExpanded] = useState(false);
  const [catalog, setCatalog] = useState([]), [planned, setPlanned] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef(null), cards = useRef(new Map());
  const signature = route.join('|');
  useEffect(() => {
    const c = new AbortController();
    loadNavigationPlaces({signal: c.signal}).then(setCatalog).catch(() => {});
    return () => c.abort();
  }, []);
  useEffect(() => {
    controller.current?.abort();controller.current = null;setBusy(false);setPlanned(null);setError('');
    setSelected(old => route.includes(old) ? old : route[0] || null);
    return () => controller.current?.abort();
  }, [signature]);
  const stops = useMemo(() => route.map((id, i) => {
    const place = byId(id), located = planned?.stops.find(p => p.id === id) || catalog.find(p => p.id === id);
    return {...place, number: i + 1, location: located?.location};
  }), [route, catalog, planned]);
  const select = useCallback(id => {
    setSelected(id);
    const card = cards.current.get(id), parent = card?.parentElement;
    if (card && parent) parent.scrollTo({left: card.offsetLeft - parent.offsetLeft,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }, []);
  const plan = async () => {
    if (busy) return;
    const c = new AbortController();controller.current = c;setBusy(true);setError('');setPlanned(null);
    const timeout = setTimeout(() => c.abort(), 30000);
    try {
      const result = await planWalkingRoute({stopIds: [...route], signal: c.signal});
      if (controller.current === c && !c.signal.aborted) setPlanned(result);
    } catch (e) {
      if (controller.current === c) setError(e.name === 'AbortError' ? '等待超时，请稍后重试。' : e.message);
    } finally {clearTimeout(timeout);if (controller.current === c) {controller.current = null;setBusy(false);}}
  };
  return <section className={`navigation ${expanded ? 'is-expanded' : ''}`} aria-label="我的栖霞路线">
    <NavigationMap stops={stops} geometry={planned?.geometry} selectedId={selected} onSelect={select} onIllustration={onIllustration}/>
    <div className="navigation-heading"><span><Footprints size={14}/>两个人，一路慢慢走</span>
      <button aria-label="查看景区导览图" onClick={onIllustration}><MapIcon size={17}/></button></div>
    <aside className="navigation-sheet" aria-label="路线景点">
      <button className="sheet-toggle" aria-label={expanded ? '收起景点列表' : '展开景点列表'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span/>{expanded ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button>
      <div className="navigation-sheet-title"><div><p className="eyebrow">OUR LITTLE JOURNEY</p><h1>留一点时间给彼此。</h1></div>
        {route.length > 0 && <button className="clear-route" onClick={() => setRoute([])}>清空</button>}</div>
      <div className="navigation-summary"><span>{route.length} 个想去的地方</span>{planned ? <span>{distance(planned.distanceMeters)} · 步行约 {Math.max(1, Math.ceil(planned.walkingSeconds / 60))} 分钟</span> : <span>按喜欢的顺序，慢慢出发</span>}</div>
      {stops.length ? <div className={`stop-carousel ${expanded ? 'expanded' : ''}`} aria-label="已选景点">
        {stops.map((place, i) => <article key={place.id} ref={node => {if (node) cards.current.set(place.id, node);else cards.current.delete(place.id);}}
          className={`navigation-card ${selected === place.id ? 'is-selected' : ''}`}>
          <button className="navigation-card-main" onClick={() => select(place.id)} aria-pressed={selected === place.id}>
            <img src={place.image} alt=""/><span className="navigation-card-copy"><small>第 {i + 1} 站 · {place.category}</small><strong>{place.name}</strong><span>{place.intro}</span></span>
          </button>
          <div className="navigation-card-actions"><button onClick={() => onDetail(place)}>看看这里</button><span/>
            {i > 0 && <button aria-label={`上移${place.name}`} onClick={() => setRoute(old => {const next = [...old];[next[i - 1], next[i]] = [next[i], next[i - 1]];return next;})}><ArrowUp size={15}/></button>}
            <button aria-label={`移除${place.name}`} onClick={() => setRoute(old => old.filter(id => id !== place.id))}><X size={16}/></button></div>
        </article>)}
        <button className="add-route-stop" onClick={onExplore}><Plus size={22}/><span>再找一个地方</span></button>
      </div> : <div className="navigation-empty"><MapPin size={23} strokeWidth={1.3}/><p>先选两个想一起去的地方。</p><button onClick={onExplore}>去发现山里的故事 <Plus size={14}/></button></div>}
      <div className="navigation-footer">{error && <p className="navigation-error" role="alert">{error}</p>}
        {planned && <p className="navigation-disclaimer">时间仅含步行，不含停留；园内通行以现场指引为准。</p>}
        {route.length > 0 && <button className="plan-route" disabled={route.length < 2 || busy} onClick={plan}>
          {busy ? <LoaderCircle size={17} className="spin"/> : <Footprints size={17}/>}{busy ? '正在寻找步行路线' : route.length < 2 ? '再选一个景点，规划路线' : planned ? '重新规划步行路线' : '规划步行路线'}</button>}
      </div>
    </aside>
  </section>;
}
