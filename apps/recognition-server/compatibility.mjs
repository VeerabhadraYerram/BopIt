// Conservative mount comparison from explicit catalog specifications, never photos.
function mount(product){
 if(product.selectionChanges?.length)return null;
 const variants=(product.variants?.selected||[]).filter(v=>/^mount$|lens[ _-]?mount/i.test(v.name));
 const entries=Object.entries(product.structuredAttributes||{}).filter(([key])=>/^(lens[ _-]?mount|mount[ _-]?type|camera[ _-]?mount|mount)$/i.test(key));
 const values=variants.length?variants.map(v=>v.label):entries.flatMap(([,v])=>Array.isArray(v)?v:[v]).filter(v=>typeof v==='string').map(v=>v.trim());
 const explicit=values.find(Boolean);if(!explicit)return null;
 const known=[[/\bcanon\s*(?:rf|rf-s)\b|^rf(?:-s)?(?:\s+mount)?$/i,'Canon RF'],[/\bcanon\s*(?:ef|ef-s)\b|^ef(?:-s)?(?:\s+mount)?$/i,'Canon EF'],[/\bsony\s*(?:e|fe)\b|^(?:e|fe)(?:[- ]mount)?$/i,'Sony E'],[/\bnikon\s*z\b|^z(?:[- ]mount)?$/i,'Nikon Z'],[/\bnikon\s*f\b|^f(?:[- ]mount)?$/i,'Nikon F'],[/\bfujifilm\s*x\b|^x[- ]mount$/i,'Fujifilm X'],[/micro\s*four\s*thirds|^m(?:icro)?\s*4\/3$/i,'Micro Four Thirds'],[/^(?:leica\s*)?l[- ]mount$/i,'L mount']];
 const matched=known.filter(([pattern])=>values.some(value=>pattern.test(value)));return matched.length===1?{name:matched[0][1],evidence:values.join('; ')}:null;
}
function kind(p){const category=String(p.category||'');const title=String(p.title||'');if(/adapter|converter|lens cap/i.test(title+' '+category))return null;if(/camera lenses|camera lens|lenses/i.test(category)||/\blens\b/i.test(title))return 'lens';if(/camera/i.test(category+' '+title))return 'camera';return null;}
export function compareCameraMounts(product,others){
 const type=kind(product);if(!type)return [];
 return others.filter(other=>kind(other)&&kind(other)!==type).map(other=>{const a=mount(product),b=mount(other);return {id:other.id,title:other.title,status:!a||!b?'unknown':a.name===b.name?'mount_match':'different_mount',message:!a||!b?`Mount information is missing for ${other.title}. Check the manufacturer's specifications before buying.`:a.name===b.name?`Both listings specify ${a.name}. Sensor coverage, autofocus and model-specific support still need checking.`:`This listing specifies ${a.name}; ${other.title} specifies ${b.name}. They do not share a native mount. An appropriate adapter may be needed.`,evidence:a&&b?[a.evidence,b.evidence]:[],blocking:false};});
}
