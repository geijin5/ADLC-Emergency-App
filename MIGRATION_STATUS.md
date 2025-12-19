# PostgreSQL Migration Status

## ✅ Completed

1. **Database Adapter Created** (`server/db.js`)
   - Supports both SQLite (dev) and PostgreSQL (prod)
   - Automatically converts SQLite placeholders (`?`) to PostgreSQL placeholders (`$1, $2, etc.`)
   - Handles RETURNING clauses for INSERT statements

2. **Table Creation Updated**
   - All CREATE TABLE statements converted to support both databases
   - SQL syntax differences handled (AUTOINCREMENT → SERIAL, DATETIME → TIMESTAMP, etc.)
   - ALTER TABLE statements wrapped in try-catch

3. **Critical Routes Updated**
   - ✅ Login route (`/api/auth/login`) - converted to async/await

## ⚠️ Remaining Work

There are **~56 more database queries** that need to be converted from callback-based to async/await pattern.

### Pattern for Conversion

**Before (callback-based):**
```javascript
app.get('/api/route', (req, res) => {
  db.all('SELECT * FROM table', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});
```

**After (async/await):**
```javascript
app.get('/api/route', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM table');
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

### Routes That Need Updating

1. **User Management** (`/api/personnel/users`)
   - GET, POST, PUT, DELETE endpoints

2. **Department Management** (`/api/personnel/departments`)
   - GET, POST, PUT, DELETE endpoints

3. **Public Routes** (`/api/public/*`)
   - All GET endpoints for alerts, closed areas, routes, etc.

4. **Personnel Routes** (`/api/personnel/*`)
   - Closed areas, parade routes, detours, closed roads
   - Callouts, chat messages, search and rescue

5. **Push Notifications**
   - Subscription management

## Quick Conversion Script

You can use find/replace with regex to help convert:

**Find:** `db\.(run|get|all)\(`(.*?),\s*\[\],\s*\(err,`  
**Replace:** `await $1($2, []).then((result) => { const err = null; const`

But manual conversion is recommended for accuracy.

## Testing

After conversion:
1. Test locally with SQLite (should work as before)
2. Deploy to Render with PostgreSQL database
3. Verify all routes work correctly
4. Check that data persists across deployments

## Next Steps

1. Create PostgreSQL database on Render
2. Complete conversion of remaining routes
3. Test thoroughly
4. Deploy and verify data persistence

