import net from 'node:net';

const PORT = 5174;
const s = net.createServer();
s.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('[keystone] Port 5174 is already in use.');
    console.error('[keystone] A Keystone frontend dev server is probably already running,');
    console.error('[keystone] or another process is holding the port.');
    console.error('');
    console.error('[keystone] Options:');
    console.error('[keystone]   1. If the app is already open, just use it and close this window.');
    console.error('[keystone]   2. To restart fresh: run stop-all.cmd first, then npm run dev.');
    console.error('');
    process.exit(1);
  }
  throw err;
});
s.once('listening', () => s.close());
s.listen(PORT, '127.0.0.1');
