import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameOriginPage } from '../lib/bridge.js';

const req = (headers) => ({ headers });

test('the page header on a loopback host is accepted even without Origin', () => {
  assert.equal(isSameOriginPage(req({ 'x-pa-request': '1', host: '127.0.0.1:50231' })), true);
  assert.equal(isSameOriginPage(req({ 'x-pa-request': '1', host: 'localhost:3080', origin: 'http://localhost:3080' })), true);
});

test('missing header, foreign host or cross-site hints are refused', () => {
  assert.equal(isSameOriginPage(req({ host: '127.0.0.1:1' })), false);
  assert.equal(isSameOriginPage(req({ 'x-pa-request': '1', host: 'evil.example.com' })), false);
  assert.equal(isSameOriginPage(req({ 'x-pa-request': '1', host: '127.0.0.1:1', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isSameOriginPage(req({ 'x-pa-request': '1', host: '127.0.0.1:1', origin: 'http://evil.example.com' })), false);
});
