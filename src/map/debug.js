/**
 * src/map/debug.js
 * Debug overlay katmanları: bileşenler (edge renkleri), snap noktaları/segmentleri,
 * dead-end düğümler. UI yok; sadece developer için.
 */

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

export function addDebugLayers(map){
  // kaynak zaten initMap’te açılıyor: 'debug'
  if (!map.getSource("debug")) {
    map.addSource("debug", { type:"geojson", data: emptyFC() });
  }

  // Kenarlar (bileşen renklendirmesi)
  if (!map.getLayer("dbg-comps")) {
    map.addLayer({ id:'dbg-comps', type:'line', source:'debug',
      filter:['==',['get','kind'],'edge'],
      paint:{
        'line-color': ['interpolate',['linear'],['coalesce',['to-number',['get','comp']],0],
          0,'#7dd3fc', 5,'#a78bfa', 10,'#f472b6', 15,'#34d399', 20,'#f59e0b', 25,'#60a5fa'],
        'line-width': 3,
        'line-opacity': 0.7
      },
      layout:{'visibility':'none'}
    });
  }

  // Snap noktaları
  if (!map.getLayer("dbg-snap")) {
    map.addLayer({ id:'dbg-snap', type:'circle', source:'debug',
      filter:['==',['get','kind'],'snap'],
      paint:{'circle-radius':6,'circle-color':'#ef4444','circle-stroke-color':'#fff','circle-stroke-width':1.5},
      layout:{'visibility':'none'}
    });
  }

  // Snap segmentleri
  if (!map.getLayer("dbg-seg")) {
    map.addLayer({ id:'dbg-seg', type:'line', source:'debug',
      filter:['==',['get','kind'],'seg'],
      paint:{'line-color':'#ef4444','line-width':3,'line-dasharray':[1,1]},
      layout:{'visibility':'none'}
    });
  }

  // Dead-ends
  if (!map.getLayer("dbg-dead")) {
    map.addLayer({ id:'dbg-dead', type:'circle', source:'debug',
      filter:['==',['get','kind'],'dead'],
      paint:{'circle-radius':4,'circle-color':'#000','circle-stroke-color':'#fff','circle-stroke-width':1},
      layout:{'visibility':'none'}
    });
  }
}

export function setDebugLayersVisible(map, visible){
  const v = visible ? 'visible' : 'none';
  ['dbg-comps','dbg-snap','dbg-seg','dbg-dead'].forEach(id=>{
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  });
}

export function updateDebugOverlay(map, graph, snaps=[], opts={}){
  // graph yoksa sadece snap/seg bas
  const feats = [];

  if (graph && opts.showComps){
    // her kenarı bir kez çizen edge feature'ları
    const seen = new Set();
    const comp = components(graph);
    for(let u=0; u<graph.nodes.length; u++){
      for(const e of (graph.adj[u]||[])){
        const v=e.to; if(u>v) continue;
        const key=u+'-'+v; if(seen.has(key)) continue; seen.add(key);
        feats.push({
          type:'Feature',
          properties:{kind:'edge', comp: comp[u]},
          geometry:{type:'LineString', coordinates:[graph.nodes[u].xy, graph.nodes[v].xy]}
        });
      }
    }
  }

  if (opts.showDead && graph){
    for(let i=0;i<graph.nodes.length;i++){
      if((graph.adj[i]||[]).length===1){
        feats.push({type:'Feature', properties:{kind:'dead'}, geometry:{type:'Point', coordinates:graph.nodes[i].xy}});
      }
    }
  }

  if (opts.showSnaps && snaps.length){
    snaps.forEach((snap, idx)=>{
      if(!snap) return;
      feats.push({type:'Feature', properties:{kind:'snap', label: idx===0?'S':'T'}, geometry:{type:'Point', coordinates:snap.xy}});
      feats.push({type:'Feature', properties:{kind:'seg',  label: idx===0?'S':'T'}, geometry:{type:'LineString', coordinates:[snap.a, snap.b]}});
    });
  }

  map.getSource('debug')?.setData({type:'FeatureCollection', features:feats});
}

function components(graph){
  const N = graph.nodes.length;
  const comp = new Array(N).fill(-1);
  let cid=0;
  for(let i=0;i<N;i++){
    if(comp[i]!==-1) continue;
    const q=[i]; comp[i]=cid;
    for(let qi=0; qi<q.length; qi++){
      const u = q[qi];
      for(const e of (graph.adj[u]||[])){
        if(comp[e.to]===-1){ comp[e.to]=cid; q.push(e.to); }
      }
    }
    cid++;
  }
  return comp;
}
