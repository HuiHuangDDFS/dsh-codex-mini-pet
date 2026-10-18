import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { STATES, MAX_BYTES, validateAtlas } from '../src/atlas.mjs';
import { extractSpriteComponents, groupAnimationComponents } from './pet-atlas-packing.mjs';

const { values } = parseArgs({ options:{ sources:{type:'string'} } });
if (!values.sources) throw new Error('Pass --sources <JSON list of the five generated high-resolution sheets>.');
const inputs = JSON.parse(await fs.readFile(values.sources, 'utf8'));
const expected = [['actions-1',4,16],['actions-2',4,16],['actions-3',4,16],['actions-4',3,9],['gaze',4,16]];
if (inputs.length !== expected.length || inputs.some((input,index) => input.name !== expected[index][0] || input.columns !== expected[index][1] || input.count !== expected[index][2])) throw new Error('Expected the four action batches followed by the sixteen-direction gaze sheet.');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const batches = [], generations = [];
for (const input of inputs) {
  const bytes = await fs.readFile(input.file), source = PNG.sync.read(bytes);
  const rows = groupAnimationComponents(extractSpriteComponents(source, {alphaThreshold:32,minPixels:1500,edgePadding:2}), Array(input.count/input.columns).fill(input.columns));
  const frames = rows.flat();
  for (const frame of frames) {
    if (frame.coreBounds.minX < 2 || frame.coreBounds.minY < 2 || frame.coreBounds.maxX > source.width-3 || frame.coreBounds.maxY > source.height-3) throw new Error(`A ${input.name} character touches the source image edge.`);
  }
  const generation = {name:input.name,sha256:digest(bytes),width:source.width,height:source.height,columns:input.columns,frames:input.count};
  generations.push(generation);
  batches.push(frames.map((frame,index) => ({...frame,source:input.name,sourceIndex:index,canonicalScale:320/(source.width/input.columns)})));
}
const actions = batches.slice(0,4).flat(), gaze = batches[4], counts = [...STATES.map(state=>state.frames),8,8];
let offset = 0;
const rows = STATES.map(state => actions.slice(offset,offset+=state.frames));
rows.push(gaze.slice(0,8),gaze.slice(8));
const hd = new PNG({width:3072,height:4576}), frames = [];
const gazeScale = Math.min(324/Math.max(...gaze.map(frame=>frame.image.width*frame.canonicalScale)),352/Math.max(...gaze.map(frame=>frame.image.height*frame.canonicalScale)));
for (let row=0;row<rows.length;row++) {
  const sourceFrames=rows[row];
  const rowScale=row>=9?gazeScale:Math.min(324/Math.max(...sourceFrames.map(frame=>frame.image.width*frame.canonicalScale)),(row===4?316:352)/Math.max(...sourceFrames.map(frame=>frame.image.height*frame.canonicalScale)));
  for (let col=0;col<sourceFrames.length;col++) {
    const frame=sourceFrames[col],scale=frame.canonicalScale*rowScale;
    const width=Math.round(frame.image.width*scale),height=Math.round(frame.image.height*scale),left=Math.floor((384-width)/2),top=392-height+(row===4?[0,-14,-28,-10,0][col]:0);
    if (left<24||top<24||left+width>360||top+height>392) throw new Error(`Frame ${row}:${col} exceeds the transparent safety margin.`);
    const pixels=await sharp(frame.image.data,{raw:{width:frame.image.width,height:frame.image.height,channels:4}}).resize(width,height).raw().toBuffer();
    for(let y=0;y<height;y++) pixels.copy(hd.data,((row*416+top+y)*hd.width+col*384+left)*4,y*width*4,(y+1)*width*4);
    frames.push({state:row<9?STATES[row].name:'gaze',row,col,source:frame.source,sourceIndex:frame.sourceIndex,sourceBounds:frame.bounds,coreBounds:frame.coreBounds,sourceCorePixels:frame.pixelCount,packedBounds:{left,top,width,height},scale});
  }
}
const pngOptions={compressionLevel:9,adaptiveFiltering:true};
const hdBytes=await sharp(PNG.sync.write(hd)).png(pngOptions).toBuffer();
if(hdBytes.length>MAX_BYTES) throw new Error('The high-resolution atlas exceeds the 20 MiB delivery budget.');
const standard=await sharp(hdBytes).resize(1536,2288).png(pngOptions).toBuffer(),validation=await validateAtlas(standard,2);
if(!validation.ok) throw new Error(validation.errors.join('\n'));
for(const cell of validation.cells.filter(cell=>cell.required)) {
  const b=cell.bounds;
  if(b.minX<12||b.minY<12||b.maxX>179||b.maxY>195) throw new Error(`Standard frame ${cell.row}:${cell.col} loses its safety margin.`);
}
const root=new URL('../assets/pets/deepseek/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('pet.json',root),'utf8'));
manifest.sha256=validation.sha256;manifest.renderSpritesheet='spritesheet-2x.png';manifest.renderSha256=digest(hdBytes);manifest.renderScale=2;
manifest.source.highResolutionGenerations=generations;
manifest.source.highResolutionPrompts='hd-prompts.md';
manifest.artwork.safeMargin=12;manifest.artwork.packing='packing.json';
manifest.artwork.render={width:3072,height:4576,cellWidth:384,cellHeight:416,safeMargin:24};
await fs.writeFile(new URL('spritesheet-2x.png',root),hdBytes);
await fs.writeFile(new URL('spritesheet.png',root),standard);
await sharp(hdBytes).extract({left:0,top:0,width:384,height:416}).png(pngOptions).toFile(fileURLToPath(new URL('preview.png',root)));
await fs.writeFile(new URL('pet.json',root),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(new URL('packing.json',root),JSON.stringify({version:2,extraction:{alphaThreshold:32,minPixels:1500,edgePadding:2},generations,standard:{width:1536,height:2288,frameMargin:12,sha256:validation.sha256},render:{width:3072,height:4576,frameMargin:24,sha256:manifest.renderSha256},frameCounts:counts,frames},null,2)+'\n');
console.log(JSON.stringify({ok:true,frames:frames.length,standard:{sha256:validation.sha256,bytes:standard.length},render:{sha256:manifest.renderSha256,bytes:hdBytes.length}},null,2));
