// At most two validated attempts, with one shared deadline. No image/model text is logged.
export function recoverDetection(primary,fallback,{hedgeAfterMs=12000,timeoutMs=45000}={}){
 return new Promise((resolve,reject)=>{
  const controllers=[new AbortController(),new AbortController()];let settled=false,backupStarted=false;const failed=[null,null];let hedge,deadline;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(hedge);clearTimeout(deadline);controllers.forEach(c=>c.abort());error?reject(error):resolve(value);};
  const transient=error=>[500,502,503,504].includes(error.status)||error.name==='TimeoutError'||error instanceof TypeError;
  const start=async(index,operation)=>{try{const value=await operation(controllers[index].signal);finish(null,value);}catch(error){if(settled)return;failed[index]=error;if(index===0&&!transient(error)){finish(error);return;}if(index===0)startBackup();if(failed[0]&&failed[1])finish(failed[1].status===404?failed[0]:failed[1]);}};
  const startBackup=()=>{if(settled||backupStarted)return;backupStarted=true;clearTimeout(hedge);start(1,fallback);};
  deadline=setTimeout(()=>finish(new DOMException('The scan deadline was reached.','TimeoutError')),timeoutMs);
  hedge=setTimeout(startBackup,hedgeAfterMs);start(0,primary);
 });
}
