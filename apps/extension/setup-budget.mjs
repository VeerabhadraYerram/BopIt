// Bounded candidate selection, not a compatibility or global best-price guarantee.
export function budgetSetup(roles,budget,currency){
  if(!Number.isFinite(budget)||budget<=0||budget>100000)throw new Error('Enter a total budget between 0 and 100,000.');
  const cap=Math.round(budget*100);
  let states=[{lines:[],ids:new Set(),cents:0,count:0}];
  for(const role of roles){
    const candidates=(role.products||[]).filter(p=>p.currency===currency&&Number.isFinite(p.price)&&p.price>0&&!['OutOfStock','out_of_stock'].includes(p.availability)).slice(0,8);
    const next=[];
    for(const state of states){
      next.push({...state,lines:[...state.lines,{role:role.label,product:null}]});
      for(const product of candidates){const cents=Math.round(product.price*100);if(state.ids.has(product.id)||state.cents+cents>cap)continue;
        next.push({lines:[...state.lines,{role:role.label,product}],ids:new Set([...state.ids,product.id]),cents:state.cents+cents,count:state.count+1});}
    }
    states=next.sort((a,b)=>b.count-a.count||a.cents-b.cents).slice(0,200);
  }
  const best=states[0];return {items:best.lines,total:best.cents/100,budget,currency,complete:best.count===roles.length};
}
