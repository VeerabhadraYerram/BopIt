import {deflate} from 'node:zlib';
import {promisify} from 'node:util';
import {crc32} from './image.mjs';
import {inflateSync} from 'node:zlib';
const compress=promisify(deflate);
export async function compressDetectionPng(base64){
 const bytes=Buffer.from(base64,'base64');if(bytes.length<256*1024)return {base64,inputBytes:bytes.length,outputBytes:bytes.length,optimized:false};
 const chunks=[],idats=[];for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);chunks.push({type,bytes:bytes.subarray(offset,offset+12+length)});if(type==='IDAT')idats.push(bytes.subarray(offset+8,offset+8+length));offset+=12+length;}
 const raw=inflateSync(Buffer.concat(idats),{maxOutputLength:64*1024*1024+8192}),packed=await compress(raw,{level:9});
 const chunk=Buffer.alloc(12+packed.length);chunk.writeUInt32BE(packed.length);chunk.write('IDAT',4);packed.copy(chunk,8);chunk.writeUInt32BE(crc32(chunk.subarray(4,-4)),chunk.length-4);
 let written=false;const output=[bytes.subarray(0,8)];for(const part of chunks){if(part.type!=='IDAT')output.push(part.bytes);else if(!written){output.push(chunk);written=true;}}
 const rebuilt=Buffer.concat(output);return rebuilt.length<bytes.length?{base64:rebuilt.toString('base64'),inputBytes:bytes.length,outputBytes:rebuilt.length,optimized:true}:{base64,inputBytes:bytes.length,outputBytes:bytes.length,optimized:false};
}
