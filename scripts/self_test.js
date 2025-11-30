const { Readable, Writable } = require('stream');
const { handleRequest } = require('../services/backend/server');

class MockReq extends Readable {
  constructor({ method, url, headers, body }) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers || {};
    this._body = body;
    this.connection = { destroy() {} };
  }

  _read() {
    if (this._body) {
      this.push(this._body);
      this._body = null;
    } else {
      this.push(null);
    }
  }
}

class MockRes extends Writable {
  constructor(resolve) {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this.on('finish', () => {
      const body = this.chunks.length ? Buffer.concat(this.chunks).toString() : null;
      let parsed = null;
      if (body) {
        try {
          parsed = JSON.parse(body);
        } catch (err) {
          parsed = body;
        }
      }
      resolve({ status: this.statusCode, body: parsed });
    });
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

function simulate(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = new MockReq({ method, url, headers: { host: 'localhost' }, body: payload });
    const res = new MockRes(resolve);
    handleRequest(req, res).catch(reject);
  });
}

async function run() {
  const report = [];

  const feed = await simulate('GET', '/feed');
  report.push({ name: 'GET /feed', pass: feed.status === 200 && feed.body.posts.length >= 3 });

  const tagFeed = await simulate('GET', '/feed/by-tag?tag=travel');
  report.push({ name: 'GET /feed/by-tag', pass: tagFeed.status === 200 && tagFeed.body.tag === 'travel' });

  const prefUpdate = await simulate('PUT', '/user/preferences', { saveMode: true });
  report.push({ name: 'PUT /user/preferences', pass: prefUpdate.status === 200 && prefUpdate.body.preferences.saveMode === true });

  const newPost = await simulate('POST', '/posts', {
    title: 'SelfTest Clip',
    tags: ['selftest'],
    durationSeconds: 20,
    resolution: '1080x1920',
  });
  const newPostId = newPost.body?.post?.id;
  report.push({ name: 'POST /posts', pass: newPost.status === 201 && newPostId });
  if (!newPostId) {
    throw new Error('Post creation failed');
  }

  const commentCreate = await simulate('POST', `/posts/${newPostId}/comments`, { body: 'Looks good' });
  report.push({ name: 'POST /posts/:id/comments', pass: commentCreate.status === 201 });

  const commentList = await simulate('GET', `/posts/${newPostId}/comments`);
  const commentCount = commentList.body?.comments?.length || 0;
  report.push({ name: 'GET /posts/:id/comments', pass: commentList.status === 200 && commentCount >= 1 });

  const bookmark = await simulate('POST', '/stats/bookmark', { postId: newPostId });
  const bookmarkDup = await simulate('POST', '/stats/bookmark', { postId: newPostId });
  report.push({ name: 'POST /stats/bookmark dedupe', pass: bookmark.status === 200 && bookmarkDup.status === 200 });

  const tagsUpdate = await simulate('POST', `/posts/${newPostId}/tags`, {
    tags: [
      { tag: 'ai', trust: 0.8 },
      { tag: 'demo', trust: 0.7 },
    ],
  });
  report.push({ name: 'POST /posts/:id/tags', pass: tagsUpdate.status === 200 && tagsUpdate.body.tags.length === 2 });

  const tagsSuggest = await simulate('GET', '/tags/suggest');
  report.push({ name: 'GET /tags/suggest', pass: tagsSuggest.status === 200 && tagsSuggest.body.suggestions.length >= 1 });

  const recompute = await simulate('POST', '/jobs/recompute');
  report.push({ name: 'POST /jobs/recompute', pass: recompute.status === 200 });

  report.forEach(item => console.log(`${item.pass ? '✔' : '✖'} ${item.name}`));
  const failed = report.filter(item => !item.pass);
  if (failed.length) {
    throw new Error('Self test failed');
  }
  console.log('All self tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
