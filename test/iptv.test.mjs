import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaylist, rewriteHls } from '../plugins/iptv/m3u.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="A.cn" tvg-logo="https://x/a.png" group-title="News",CCTV-1, 综合
http://a.example/1.m3u8
#EXTINF:-1 group-title="Sports",Sport One
https://b.example/2.m3u8
#EXTINF:-1,Dup
https://b.example/2.m3u8
#EXTGRP:Movies
#EXTINF:-1,Film
rtmp://c.example/live
`;

test('parsePlaylist reads names, groups, logos and drops duplicate URLs', () => {
  const { channels, groups } = parsePlaylist(SAMPLE);
  assert.equal(channels.length, 3);
  assert.equal(channels[0].name, 'CCTV-1, 综合');
  assert.equal(channels[0].group, 'News');
  assert.equal(channels[0].logo, 'https://x/a.png');
  assert.equal(channels[2].group, 'Movies');
  assert.equal(groups.length, 3);
  assert.notEqual(channels[0].id, channels[1].id);
});

test('a bare HLS playlist becomes one channel', () => {
  const { channels } = parsePlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg1.ts\n', 'https://h.example/live/index.m3u8');
  assert.equal(channels.length, 1);
  assert.equal(channels[0].url, 'https://h.example/live/index.m3u8');
});

test('rewriteHls proxies segments, variants and key URIs, resolving relative references', () => {
  const wrap = (u) => 'P(' + u + ')';
  const out = rewriteHls('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4,\nseg/1.ts\nhttps://z.example/2.ts\n', 'https://h.example/a/b/index.m3u8', wrap);
  assert.match(out, /URI="P\(https:\/\/h\.example\/a\/b\/key\.bin\)"/);
  assert.match(out, /^P\(https:\/\/h\.example\/a\/b\/seg\/1\.ts\)$/m);
  assert.match(out, /^P\(https:\/\/z\.example\/2\.ts\)$/m);
  assert.match(out, /^#EXTINF:4,$/m);
});
