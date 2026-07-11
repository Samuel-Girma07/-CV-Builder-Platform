const fs = require('fs');
const cssPath = 'public/css/style.css';

const skeletonStyles = `
/* Skeleton Loaders */
.skel {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skel.hero { height: 140px; border-radius: var(--r-card); margin-bottom: 24px; }
.skel.tile { height: 80px; border-radius: var(--r-card); }
`;

fs.appendFileSync(cssPath, skeletonStyles);
console.log('✅ Skeleton styles added to style.css');
