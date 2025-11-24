# Build Configuration Guide

## Overview

Complete guide to Synercore's build, transpilation, and optimization configuration. Covers Babel, Vite, TypeScript, and production deployment.

---

## Babel Configuration

### File: `.babelrc`

Babel handles JavaScript transpilation for:
- Modern JavaScript features → ES5 compatibility
- JSX → JavaScript function calls
- TypeScript → JavaScript

### Configuration Hierarchy

**Base Presets** (all environments):
```json
{
  "presets": [
    ["@babel/preset-env", {...}],
    ["@babel/preset-react", {...}],
    "@babel/preset-typescript"
  ]
}
```

#### @babel/preset-env
- **Target**: Node 18.x + modern browsers (>1%, last 2 versions)
- **useBuiltIns**: "entry" - Include polyfills for all targets
- **corejs**: 3 - Polyfill library version
- **modules**: false (production) / commonjs (test)

**Benefits**:
- ✅ Automatic polyfill injection
- ✅ Only transpiles needed features
- ✅ Smaller output files
- ✅ Better browser compatibility

#### @babel/preset-react
- **runtime**: "automatic" - Uses React 17+ automatic JSX transform
- **development**: true/false - Includes source maps in dev

**Benefits**:
- ✅ No need to import React for JSX
- ✅ Smaller output files
- ✅ Better error messages in development

#### @babel/preset-typescript
- Removes TypeScript annotations
- Preserves JavaScript syntax
- Works with all JavaScript features

### Plugins

**Base Plugins** (all environments):
1. `@babel/plugin-transform-runtime`
   - Extracts helper functions
   - Reuses common utilities
   - Reduces output size

2. `@babel/plugin-proposal-class-properties`
   - Enables class field syntax

3. `@babel/plugin-proposal-decorators`
   - Enables decorator syntax

**Development-Only Plugins**:
- `react-refresh/babel` - Fast refresh for hot module reloading

### Environment-Specific Configuration

#### Development Environment
```json
{
  "plugins": [
    "@babel/plugin-transform-runtime",
    "react-refresh/babel"
  ]
}
```

Enables:
- ✅ Fast Refresh (HMR)
- ✅ Source maps
- ✅ Development error messages

#### Production Environment
```json
{
  "plugins": [
    "@babel/plugin-transform-runtime"
  ]
}
```

Optimizations:
- ✅ Drop console statements
- ✅ Drop debugger statements
- ✅ Minify output
- ✅ Remove source maps

#### Test Environment
```json
{
  "targets": { "node": "current" },
  "modules": "commonjs"
}
```

Features:
- ✅ CommonJS for Jest
- ✅ Latest Node features
- ✅ Full source maps

---

## Vite Configuration

### File: `vite.config.mjs`

Vite handles:
- Development server with HMR
- Frontend bundling and optimization
- Multi-page application builds
- Asset optimization

### Development Server Configuration

```javascript
server: {
  port: 3002,
  host: '0.0.0.0',
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    /\.ngrok(-free)?\.app$/
  ],
  proxy: {
    '/api': 'http://localhost:5001'
  },
  hmr: true  // Hot Module Replacement
}
```

**Features**:
- ✅ Runs on port 3002
- ✅ Accessible from remote hosts (ngrok tunnels)
- ✅ Proxies API calls to backend (port 5001)
- ✅ Hot Module Replacement for instant feedback

### Build Optimization

#### Minification
```javascript
minify: 'terser',
target: 'ES2020',
sourcemap: false,
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true
  }
}
```

- ✅ Terser minifier (best performance)
- ✅ ES2020 target (small output)
- ✅ Removes console/debugger statements
- ✅ No source maps in production

#### Code Splitting

Manual chunk splitting optimizes for:
1. **Vendor splitting** - Separate by library
   - `react-vendor` - React ecosystem
   - `chart-vendor` - Charting libraries (jsPDF, Chart.js)
   - `state-vendor` - State management (Zustand, Socket.io)
   - `vendor` - Other node_modules

2. **Feature-based splitting**
   - `components` - Reusable components
   - `pages` - Route components
   - `utils` - Utility functions and services
   - `main` - Application entry point

**Benefits**:
- ✅ Better caching (vendor files rarely change)
- ✅ Parallel downloads (multiple files)
- ✅ Reduced initial load (smaller main bundle)
- ✅ Faster updates (only changed chunks reload)

#### Chunk Size Configuration

```javascript
chunkSizeWarningLimit: 600  // kb
```

- Increases warning threshold to 600KB
- Large chunks expected with full-featured app
- Monitor with `npm run build`

### Multi-Page Application

```javascript
input: {
  main: './index.html',
  supplier: './supplier.html'
}
```

Builds two entry points:
- **main** - Dashboard and admin interface
- **supplier** - Supplier portal

Each gets its own:
- ✅ HTML file
- ✅ JavaScript bundle
- ✅ CSS stylesheet
- ✅ Asset references

---

## TypeScript Configuration

### File: `tsconfig.json`

#### Compiler Options

**Language & Environment**:
```json
{
  "target": "ES2022",
  "lib": ["ES2022"],
  "module": "ES2022",
  "moduleResolution": "node"
}
```

- ✅ Modern JavaScript features
- ✅ ES modules
- ✅ Node.js module resolution

**Emit Settings**:
```json
{
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true,
  "outDir": "./dist-server",
  "rootDir": "./server",
  "removeComments": true,
  "noEmit": true
}
```

- ✅ Generate type definitions (.d.ts)
- ✅ Source maps for debugging
- ✅ Separate server output
- ✅ Type checking only (no transpilation)

**Import Extensions**:
```json
{
  "allowImportingTsExtensions": true,
  "resolveJsonModule": true
}
```

- ✅ Import `.ts` files in code
- ✅ Import `.json` files
- ✅ Full ES module support

**Strict Type Checking**:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true
}
```

- ✅ Strictest type checking
- ✅ Catches most errors at compile time
- ✅ Ensures high code quality

**Path Mapping**:
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["server/*"],
    "@db/*": ["server/db/*"],
    "@utils/*": ["server/utils/*"],
    "@routes/*": ["server/routes/*"]
  }
}
```

- ✅ Alias imports (@utils instead of ../../../utils)
- ✅ Cleaner import statements
- ✅ Easier refactoring

#### Include/Exclude

```json
{
  "include": ["server/**/*.ts", "server/**/*.tsx"],
  "exclude": ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
}
```

- ✅ Type-check server code
- ✅ Exclude tests from main build
- ✅ Exclude node_modules

---

## Build Pipeline

### Development Workflow

```bash
npm run dev
```

Runs:
1. **Vite dev server** (localhost:3002)
2. **Hot Module Replacement** (instant reloads)
3. **API proxy** (to backend on port 5001)
4. **React refresh** (preserves component state)

**Features**:
- ✅ Instant feedback
- ✅ Preserved state during edits
- ✅ Full source maps
- ✅ Error overlays

### Production Build

```bash
npm run build
```

Process:
1. **Transpilation**
   - Babel converts JSX/TypeScript
   - Vite handles module bundling

2. **Optimization**
   - Tree-shaking (remove unused code)
   - Code splitting (vendor + features)
   - Minification (terser)

3. **Asset Processing**
   - Image optimization
   - CSS minification
   - Hash-based filenames

4. **Output**
   - Production-ready files in `dist/`
   - Can be deployed to CDN
   - ~400KB gzip (with all features)

### TypeScript Type Checking

```bash
npx tsc --noEmit
```

Checks types without emitting JavaScript:
- ✅ Validates all code
- ✅ Catches errors early
- ✅ No runtime impact
- ✅ Fast (cached)

**CI/CD Integration**:
Add to pre-commit hooks:
```bash
npx tsc --noEmit && npm run build
```

---

## Performance Metrics

### Bundle Analysis

**Development Build**:
- Main: ~5MB (unminified)
- All files: ~200MB (node_modules)
- Rebuild: <200ms (cached)

**Production Build**:
- Total: ~1.7MB (before gzip)
- Gzip: ~460KB (compressed)
- Brotli: ~380KB (better compression)

**Chunk Breakdown** (gzip):
```
react-vendor       92KB   (React, DOM)
chart-vendor      165KB   (Charts, PDF)
vendor            276KB   (Everything else)
components        114KB   (UI components)
main               15KB   (Entry point)
pages              15KB   (Route components)
state-vendor        6KB   (State management)
utils               8KB   (Utilities)
```

### Load Times

**Browser Timeline**:
1. HTML download: ~5ms
2. JavaScript parse: ~100ms
3. React initialize: ~50ms
4. Component render: ~100ms
5. **Total**: ~250ms to interactive

### Optimization Opportunities

If bundle gets too large:

1. **Code splitting**
   ```javascript
   const Component = React.lazy(() => import('./Component'));
   ```

2. **Tree-shaking**
   - Use ES modules (not CommonJS)
   - Avoid wildcard imports

3. **Dynamic imports**
   ```javascript
   const data = await import('./large-data.json');
   ```

4. **Lazy loading routes**
   ```javascript
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

---

## Deployment

### Build for Production

```bash
npm run build
npm start
```

The build creates static files in `dist/`:
```
dist/
├── index.html
├── supplier.html
├── assets/
│   ├── index-[hash].js
│   ├── supplier-[hash].js
│   ├── react-vendor-[hash].js
│   ├── chart-vendor-[hash].js
│   ├── vendor-[hash].js
│   ├── components-[hash].js
│   ├── pages-[hash].js
│   ├── utils-[hash].js
│   ├── *.css
│   └── *.png
```

### Deployment Checklist

- [ ] Run `npm run build` - Success with no errors
- [ ] Check bundle size - < 500KB gzip
- [ ] Verify chunk files - All hash-named
- [ ] Test production build locally: `npm run preview`
- [ ] Set API_URL for production
- [ ] Enable GZIP compression on server
- [ ] Set proper cache headers
- [ ] Monitor Core Web Vitals

### Server Configuration

**Headers** (nginx example):
```nginx
# Cache busting with hash
location ~* \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML files don't cache
location ~ \.html$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# Enable GZIP
gzip on;
gzip_types text/plain text/css text/javascript application/javascript;
gzip_min_length 1000;
```

---

## Troubleshooting

### "Module not found"

**Cause**: Missing file or wrong path

**Solution**:
1. Check spelling
2. Verify file exists
3. Use correct path alias (@utils, not ../utils)
4. Run `npm install`

### Build is slow

**Cause**: Large bundle or many modules

**Solution**:
1. Check for unused dependencies
2. Enable build caching: `--incremental`
3. Use dynamic imports for large features
4. Profile with: `npm run build -- --analyze`

### "Chunk larger than 500KB"

**Cause**: One file too large

**Solution**:
1. Increase limit: `chunkSizeWarningLimit: 600`
2. Or, split further with dynamic import

### TypeScript errors in tests

**Cause**: tsconfig.json affects tests

**Solution**:
1. Jest uses `.babelrc` (not tsconfig)
2. Test preset has correct modules: "commonjs"
3. Run: `NODE_OPTIONS='--experimental-vm-modules' npm test`

### HMR not working

**Cause**: Network issues or config

**Solution**:
1. Check browser console for errors
2. Verify proxy URL is correct
3. Check CORS headers
4. Try disabling HMR: `hmr: false`

---

## Best Practices

### Development

✅ DO:
- Use path aliases (@utils)
- Run `npm run dev` for development
- Use source maps for debugging
- Keep components small
- Use React.lazy for large features

❌ DON'T:
- Import from node_modules directly
- Use CommonJS require()
- Commit dist/ folder
- Manual minification
- Mix ESM and CommonJS

### Production

✅ DO:
- Run `npm run build` to verify
- Use hash-based filenames
- Set cache headers properly
- Monitor bundle size
- Test on staging first

❌ DON'T:
- Deploy with source maps
- Allow console logs
- Cache HTML files long-term
- Include unused dependencies
- Skip TypeScript checking

### Dependencies

✅ Good practices:
- Keep packages updated
- Use exact versions (not ^)
- Audit for vulnerabilities
- Tree-shake unused code
- Use lightweight alternatives

---

## Configuration Summary

| Setting | Value | Purpose |
|---------|-------|---------|
| Babel Target | Node 18 + modern browsers | Maximum compatibility |
| Vite Port | 3002 | Avoid conflicts |
| API Proxy | http://localhost:5001 | Dev convenience |
| TypeScript Target | ES2022 | Modern features |
| Build Output | dist/ | Production ready |
| Minifier | Terser | Best compression |
| Source Maps | Production: off, Dev: on | Debugging support |
| Chunk Size Limit | 600KB | Warning threshold |

---

## Additional Resources

- [Babel Documentation](https://babeljs.io)
- [Vite Guide](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting)
- [Web Vitals](https://web.dev/vitals)

---

**Last Updated**: November 21, 2025
**Version**: 1.0
**Status**: Production Ready
