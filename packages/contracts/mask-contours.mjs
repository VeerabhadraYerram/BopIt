// Trace true raster-mask edges, preserving disconnected parts and holes.
// Coordinates are normalized within the selected object's box.
export function maskContours(data, width, height, maxRings = 12) {
  const edges = new Map();
  const key = (x,y) => y * (width+1) + x;
  const add = (x,y,a,b) => { const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(key(a,b)); };
  const on = (x,y) => x>=0&&y>=0&&x<width&&y<height&&data[y*width+x];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(on(x,y)) {
    if(!on(x,y-1))add(x,y,x+1,y);
    if(!on(x+1,y))add(x+1,y,x+1,y+1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1);
    if(!on(x-1,y))add(x,y+1,x,y);
  }
  const rings=[];
  while(edges.size) {
    const start=edges.keys().next().value,ring=[];let current=start,closed=false;
    for(let steps=0;steps<width*height*4;steps++) {
      ring.push([current%(width+1),Math.floor(current/(width+1))]);
      const next=edges.get(current);if(!next?.length)break;
      const value=next.pop();if(!next.length)edges.delete(current);current=value;
      if(current===start){closed=true;break;}
    }
    if(!closed||ring.length<4)continue;
    let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}
    if(Math.abs(area)<8)continue;
    // Remove collinear points exactly; smooth with a bounded sampling budget.
    const corners=ring.filter((b,i)=>{const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});
    const step=Math.max(1,Math.ceil(corners.length/300));
    rings.push({area:Math.abs(area),points:corners.filter((_,i)=>i%step===0).map(([x,y])=>[x/width,y/height])});
  }
  return rings.sort((a,b)=>b.area-a.area).slice(0,maxRings).map(r=>r.points);
}
