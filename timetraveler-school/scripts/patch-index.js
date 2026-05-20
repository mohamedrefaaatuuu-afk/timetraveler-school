// Patch dist/public/index.html to redirect #/schools → #/login before app loads
const fs = require('fs');
const path = require('path');

const file = path.join('dist', 'public', 'index.html');
if (!fs.existsSync(file)) {
  // Try dist/client/index.html (TanStack Start client output)
  const alt = path.join('dist', 'client', 'index.html');
  if (fs.existsSync(alt)) {
    patchFile(alt);
  } else {
    // Search for any index.html in dist/
    const { execSync } = require('child_process');
    const found = execSync('find dist/ -name index.html 2>/dev/null || echo ""').toString().trim();
    if (found) {
      found.split('\n').forEach(f => patchFile(f.trim()));
    } else {
      console.log('No index.html found in dist/');
      process.exit(1);
    }
  }
} else {
  patchFile(file);
}

function patchFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const redirectScript = [
    '<script>',
    '(function(){',
    'var h=window.location.hash;',
    'if(h==="#/schools"||h===""||h==="#/"||h==="#"){',
    'window.location.replace("/#/login");',
    '}',
    '})();',
    '</script>'
  ].join('');
  
  if (html.includes('window.location.replace')) {
    console.log('Already patched:', filePath);
    return;
  }
  
  // Insert before first <script type="module"
  html = html.replace('<script type="module"', redirectScript + '\n    <script type="module"');
  fs.writeFileSync(filePath, html);
  console.log('Patched:', filePath);
  console.log('Script tags found:', (html.match(/<script/g) || []).length);
}
