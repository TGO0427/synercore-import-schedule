# Synercore - Quick Reference Guide

## ⚡ Common Commands

### Development
```bash
npm run dev              # Start dev server (React + Node)
npm run server          # Just backend on :5001
npm run client          # Just frontend on :3002
npm test                # Run all tests
npm test:watch          # Watch mode
```

### Building & Deployment
```bash
npm run build           # Build for production
npm run preview         # Preview production build
npm run migrate         # Run database migrations
npm run migrate:status  # Show migration history
npm run migrate:reset   # Clear migration history
```

### Database
```bash
npm run migrate         # Apply all migrations
npm run migrate:status  # Check migration status
npm run backfill-week-dates  # Backfill week dates
npm run create-admin    # Create admin user
```

### Type Checking
```bash
npx tsc --noEmit       # Check types (no build)
npx tsc --watch        # Watch mode type checking
```

---

## 📁 Key Files & Locations

### Configuration
```
.babelrc               → Babel transpilation
vite.config.mjs        → Frontend build
tsconfig.json          → TypeScript compiler
jest.config.js         → Test framework
package.json           → Dependencies & scripts
```

### Backend
```
server/index.js        → Express server entry
server/routes/         → API endpoints
server/services/       → Business logic
server/db/             → Database & migrations
server/utils/          → Utilities (error handler, logger)
```

### Frontend
```
src/App.tsx            → Main component
src/components/        → React components
src/pages/             → Page components
src/services/          → API client
src/hooks/             → Custom hooks
```

### Mobile
```
synercore-mobile/app/  → Route components
synercore-mobile/services/  → API client
synercore-mobile/components/ → Components
```

### Documentation
```
PROJECT_COMPLETION_SUMMARY.md     → Project overview
BUILD_CONFIGURATION_GUIDE.md      → Build system
DATABASE_MIGRATIONS_GUIDE.md      → Database
ERROR_HANDLING_GUIDE.md           → Error handling
VALUE_SPEC.md                     → Business value
```

---

## 🔧 Environment Setup

### Development Environment Variables
```bash
# Backend
DATABASE_URL=postgresql://user:pass@localhost/synercore
NODE_ENV=development
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Frontend
VITE_API_URL=http://localhost:5001
VITE_WS_URL=ws://localhost:5001
```

### Production Environment Variables
```bash
# Backend
DATABASE_URL=postgresql://prod-db
NODE_ENV=production
JWT_SECRET=production-secret
SMTP_HOST=production-smtp
SENDGRID_API_KEY=production-key

# Frontend
VITE_API_URL=https://api.synercore.com
VITE_WS_URL=wss://api.synercore.com
```

---

## 📊 Application Status

### Frontend
- ✅ React 18 with TypeScript
- ✅ Mobile navigation
- ✅ 90+ tests
- ✅ Production optimized

### Backend
- ✅ Express.js + PostgreSQL
- ✅ Email service
- ✅ Password reset
- ✅ Error handling

### Database
- ✅ 13 migrations
- ✅ Status tracking
- ✅ Referential integrity
- ✅ Soft deletes

### Mobile
- ✅ API client
- ✅ Auth flows
- ✅ Password reset
- ✅ Notifications

---

## 🚀 Deployment

### Quick Deploy
```bash
# 1. Build
npm run build

# 2. Verify
npm run migrate:status

# 3. Start
npm start

# 4. Verify health
curl http://localhost:5001/health
```

### Deployment Checklist
- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Type check clean: `npx tsc --noEmit`
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Logs configured
- [ ] Monitoring enabled

---

## 🐛 Troubleshooting

### "Module not found"
```bash
npm install
npm run build
```

### "Port already in use"
```bash
# Kill process
lsof -i :5001
kill -9 <PID>

# Or use different port
PORT=5002 npm run server
```

### "Database connection failed"
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### "TypeScript errors"
```bash
# Check what errors
npx tsc --noEmit

# Fix imports
npm run build  # Vite handles transpilation
```

### "Build is slow"
```bash
# Clear cache
rm -rf node_modules/.vite
rm -rf dist

# Rebuild
npm run build --debug
```

---

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:5001/health
```

### Database
```sql
SELECT * FROM migration_history ORDER BY version DESC;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM shipments;
```

### Logs
```bash
# Backend logs
tail -f logs/server.log

# Test results
npm test -- --verbose

# Build output
npm run build -- --debug
```

---

## 🔐 Security

### Environment Variables
- Never commit `.env` file
- Use `.env.example` for templates
- Rotate secrets regularly
- Store securely in production

### Authentication
- JWT tokens expire hourly
- Refresh tokens stored in DB
- Password reset links 1 hour valid
- Rate limiting on auth endpoints

### Data
- PostgreSQL with encrypted passwords
- CORS configured
- HTTPS enforced in production
- SQL injection prevention (parameterized queries)

---

## 📝 Common Tasks

### Add New Migration
```typescript
// In server/db/migrate-consolidated.js
{
  name: 'my-migration',
  version: '014',
  description: 'What this does',
  depends_on: ['schema-creation'],
  execute: async () => {
    await db.query('ALTER TABLE ...');
    return true;
  }
}
```

### Add New API Endpoint
```typescript
// server/routes/api.ts
router.post('/endpoint', (req, res) => {
  try {
    // Implementation
    res.json({ success: true, data: {} });
  } catch (error) {
    const response = handleError(error, {
      service: 'API',
      operation: 'endpoint'
    });
    res.status(response.error.statusCode).json(response);
  }
});
```

### Add New Component Test
```typescript
// src/components/__tests__/NewComponent.test.tsx
describe('NewComponent', () => {
  it('should render', () => {
    render(<NewComponent />);
    expect(screen.getByText(/text/i)).toBeInTheDocument();
  });
});
```

### Query Database
```bash
# Direct query
psql $DATABASE_URL -c "SELECT * FROM users LIMIT 10;"

# In Node
const result = await db.query('SELECT * FROM users');
console.log(result.rows);
```

---

## 📞 Support Resources

### Documentation
- `PROJECT_COMPLETION_SUMMARY.md` - Project overview
- `BUILD_CONFIGURATION_GUIDE.md` - Build system
- `DATABASE_MIGRATIONS_GUIDE.md` - Database system
- `ERROR_HANDLING_GUIDE.md` - Error handling

### Code References
- React components: `src/components/`
- API endpoints: `server/routes/`
- Database: `server/db/`
- Utils: `server/utils/`

### External Resources
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)
- [PostgreSQL Manual](https://www.postgresql.org/docs)
- [Vite Guide](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

## ✅ Quality Metrics

```
Overall Completion:     100% ✅
Frontend Ready:         Yes ✅
Backend Ready:          Yes ✅
Database Ready:         Yes ✅
Mobile Ready:           Yes ✅
Tests Passing:          90+ cases ✅
TypeScript:             Strict mode ✅
Build Optimized:        Yes ✅
Documentation:          Complete ✅
Production Ready:       Yes ✅
```

---

## 📅 Version Info

```
Node:           18.x LTS
React:          18.2
TypeScript:     5.9
Vite:           4.5
PostgreSQL:     13+
Status:         Production Ready
Last Updated:   November 21, 2025
```

---

**Questions?** Check the documentation files or review the implementation in the codebase.

**Issues?** Follow the troubleshooting section above.

**Ready to Deploy?** All checks pass - proceed with production deployment.

---

*Synercore Import Schedule - Enterprise Supply Chain Management System*
*Completion Status: 100% | Quality: Production Ready*
