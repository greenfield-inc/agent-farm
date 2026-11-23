import test from 'node:test';
import assert from 'node:assert/strict';
import { enhancePlayers } from './player.mjs';

function fixture(play = async () => {}) {
  const video = new EventTarget();
  video.controls = true;
  let plays = 0;
  video.play = () => { plays++; return play(); };
  video.focus = () => { video.focused = true; };
  const button = new EventTarget(); button.hidden = true;
  const status = {hidden:true};
  const player = {dataset:{},querySelector: selector => ({video,'.play-preview':button,'.player-status':status})[selector]};
  return {video,button,status,player,root:{querySelectorAll:()=>[player]},plays:()=>plays};
}
const click = (button, detail = 1) => {
  const event = new Event('click'); Object.defineProperty(event, 'detail', {value:detail}); button.dispatchEvent(event);
};
const settle = () => new Promise(resolve => setImmediate(resolve));

test('enhancement does not start media and keeps native controls out from under the preview button', () => {
  const f = fixture(); enhancePlayers(f.root);
  assert.equal(f.plays(),0); assert.equal(f.button.hidden,false); assert.equal(f.video.controls,false);
  f.video.dispatchEvent(new Event('click'));
  assert.equal(f.plays(),0); // No competing video toggle handler.
});

test('one preview action starts one play; native player stays usable after pause and end', async () => {
  const f = fixture(); enhancePlayers(f.root); enhancePlayers(f.root);
  click(f.button); await settle();
  assert.equal(f.plays(),1); assert.equal(f.button.hidden,true); assert.equal(f.video.controls,true);
  for (const type of ['playing','pause','ended']) f.video.dispatchEvent(new Event(type));
  assert.equal(f.button.hidden,true); assert.equal(f.video.controls,true); assert.equal(f.plays(),1);
});

test('keyboard activation transfers focus from the hidden button to the native player', async () => {
  const f = fixture(); enhancePlayers(f.root); click(f.button,0); await settle();
  assert.equal(f.video.focused,true); assert.equal(f.plays(),1);
});

test('rejected or synchronous failed play leaves controls available and announces a useful fallback', async () => {
  for (const play of [() => Promise.reject(new Error('blocked')), () => {throw new Error('unsupported');}]) {
    const f = fixture(play); enhancePlayers(f.root); click(f.button); await settle();
    assert.equal(f.button.hidden,true); assert.equal(f.video.controls,true); assert.equal(f.status.hidden,false);
    f.video.dispatchEvent(new Event('playing')); assert.equal(f.status.hidden,true);
  }
});

test('only the selected preview starts when multiple players exist', async () => {
  const a = fixture(), b = fixture();
  enhancePlayers({querySelectorAll:()=>[a.player,b.player]});
  click(b.button); await settle(); assert.equal(a.plays(),0); assert.equal(b.plays(),1);
});
