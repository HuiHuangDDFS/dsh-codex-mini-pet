import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSpriteComponents, groupAnimationComponents } from '../scripts/pet-atlas-packing.mjs';

function blankImage(width,height) {
  return {width,height,data:Buffer.alloc(width*height*4)};
}
function pixel(image,x,y,alpha=255) {
  const offset=(y*image.width+x)*4;
  image.data.set([53,123,211,alpha],offset);
}
function rectangle(image,{minX,minY,maxX,maxY},alpha=255) {
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)pixel(image,x,y,alpha);
}
function extractedAlpha(component,x,y) {
  const {bounds,image}=component;
  if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY)return 0;
  return image.data[((y-bounds.minY)*image.width+x-bounds.minX)*4+3];
}
function irregularSprites() {
  const image=blankImage(120,100);
  // Both the top-left pose and the lower pose cross the boundaries of a uniform 2-by-2 cut.
  const poses=[
    {minX:9,minY:4,maxX:65,maxY:22},
    {minX:82,minY:9,maxX:110,maxY:31},
    {minX:40,minY:43,maxX:79,maxY:90},
  ];
  for(const pose of poses)rectangle(image,pose);
  return {image,poses};
}

test('irregular sprite rows preserve complete characters across uniform grid boundaries',()=>{
  const {image,poses}=irregularSprites();
  const components=extractSpriteComponents(image,{minPixels:40});
  assert.equal(components.length,3);
  for(const pose of poses){
    const component=components.find(item=>extractedAlpha(item,pose.minX,pose.minY)===255);
    assert.ok(component,`missing character starting at ${pose.minX},${pose.minY}`);
    assert.deepEqual(component.bounds,pose);
    assert.equal(component.image.width,pose.maxX-pose.minX+1);
    assert.equal(component.image.height,pose.maxY-pose.minY+1);
    assert.equal(component.pixelCount,component.image.width*component.image.height);
    for(let y=pose.minY;y<=pose.maxY;y++)for(let x=pose.minX;x<=pose.maxX;x++)assert.equal(extractedAlpha(component,x,y),255);
  }
  const rows=groupAnimationComponents(components.toReversed(),[2,1]);
  assert.deepEqual(rows.map(row=>row.map(component=>component.bounds)),[poses.slice(0,2),poses.slice(2)]);
});

test('a faint alpha-8 bridge does not merge adjacent sprite characters',()=>{
  const image=blankImage(50,24);
  const left={minX:5,minY:5,maxX:14,maxY:14},right={minX:30,minY:5,maxX:39,maxY:14};
  rectangle(image,left);rectangle(image,right);
  for(let x=15;x<30;x++)pixel(image,x,9,8);
  const components=extractSpriteComponents(image,{alphaThreshold:32,minPixels:20,edgePadding:2});
  assert.equal(components.length,2);
  for(const component of components)assert.equal(component.pixelCount,100);
  const leftComponent=components.find(component=>extractedAlpha(component,5,5)===255);
  const rightComponent=components.find(component=>extractedAlpha(component,30,5)===255);
  assert.ok(leftComponent);assert.ok(rightComponent);
  assert.notEqual(leftComponent,rightComponent);
  assert.equal(extractedAlpha(leftComponent,30,5),0);
  assert.equal(extractedAlpha(rightComponent,5,5),0);
});

test('nearby alpha-16 antialiasing survives extraction while distant noise inside the crop is cleared',()=>{
  const image=blankImage(40,36);
  rectangle(image,{minX:12,minY:8,maxX:17,maxY:25});
  rectangle(image,{minX:18,minY:18,maxX:29,maxY:23});
  // The inclusive alpha threshold is part of the body and counts toward its 180 core pixels.
  pixel(image,12,8,32);
  pixel(image,11,14,16);pixel(image,10,14,16);
  // This fleck is inside the character's overall rectangle, but far from both the body and arm.
  pixel(image,27,10,16);
  const components=extractSpriteComponents(image,{alphaThreshold:32,minPixels:20,edgePadding:2});
  assert.equal(components.length,1);
  const component=components[0];
  assert.equal(component.pixelCount,180);
  assert.equal(extractedAlpha(component,12,8),32);
  assert.equal(extractedAlpha(component,11,14),16);
  assert.equal(extractedAlpha(component,10,14),16);
  assert.equal(component.bounds.minX,10);
  assert.equal(component.image.width,component.bounds.maxX-component.bounds.minX+1);
  assert.equal(component.image.height,component.bounds.maxY-component.bounds.minY+1);
  assert.equal(extractedAlpha(component,27,10),0);
});

test('animation grouping rejects the wrong row frame counts even when the total is unchanged',()=>{
  const {image}=irregularSprites();
  const components=extractSpriteComponents(image,{minPixels:40});
  assert.throws(()=>groupAnimationComponents(components,[1,2]));
  assert.throws(()=>groupAnimationComponents(components,[2,2]));
});
