const fs = require('fs');
const path = require('path');

// Files to move to public directory
const filesToMove = [
  'style.css',
  'script.js',
  'index.html'
];

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Move files to public directory
filesToMove.forEach(file => {
  const source = path.join(__dirname, file);
  const dest = path.join(publicDir, file);
  
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    console.log(`Moved ${file} to public/`);
  }
});

console.log('File movement complete!');
