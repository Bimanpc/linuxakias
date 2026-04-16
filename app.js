// server.js
const express = require('express');
const { execFile } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Whitelist of allowed commands and optional fixed args
const WHITELIST = {
  'uptime': [],
  'df': ['-h'],
  'free': ['-m'],
  'ls': ['-la'], // if you allow ls, consider restricting path handling
  'uname': ['-a']
};

// Simple auth middleware placeholder (replace with real auth)
function requireAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (token === 'Bearer secret-token') return next();
  res.status(401).send('Unauthorized');
}

app.post('/api/exec', requireAuth, (req, res) => {
  const { cmd } = req.body || {};
  if (!cmd || typeof cmd !== 'string') return res.status(400).json({ error: 'Missing cmd' });

  // Extract base command (first token) and ignore complex shell features
  const parts = cmd.trim().split(/\s+/);
  const base = parts[0];

  if (!WHITELIST[base]) {
    return res.status(403).json({ error: 'Command not allowed' });
  }

  // Use only the whitelisted args; do not pass user-supplied args directly unless validated
  const allowedArgs = WHITELIST[base].slice();
  // Optionally allow a single safe path argument for certain commands:
  if (base === 'ls' && parts[1]) {
    // Basic validation: allow only relative paths without shell metacharacters
    if (/^[\w\-./]+$/.test(parts[1])) allowedArgs.push(parts[1]);
  }

  const child = execFile(base, allowedArgs, { timeout: 5000, maxBuffer: 200 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      // Distinguish timeout or execution errors
      const errMsg = err.killed ? 'Command timed out' : err.message;
      return res.status(200).json({ stdout: stdout || '', stderr: stderr || '', error: errMsg });
    }
    res.json({ stdout: stdout || '', stderr: stderr || '' });
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`PromptOp backend listening on port ${PORT}`));
