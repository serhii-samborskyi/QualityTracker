# Coolify Deployment

This project is ready to deploy as a Dockerfile-based application in Coolify.

## Recommended Coolify Setup

1. Create or attach a PostgreSQL database in Coolify.
2. Create a new Application from this repository.
3. Select `Dockerfile` as the build pack.
4. Set the internal port to `5000`.
5. Add persistent storage:
   - Container path: `/app/uploads`
6. Add environment variables:
   - `DATABASE_URL`: the PostgreSQL connection string from Coolify
   - `SESSION_SECRET`: a long random string
   - `ONESIGNAL_APP_ID`: optional
   - `ONESIGNAL_API_KEY`: optional
   - `VITE_ONESIGNAL_APP_ID`: optional
7. Deploy.

## Database Schema

On startup, the app creates any missing tables and seeds default users/status icons. You can also push the Drizzle schema manually from a development checkout if you prefer:

```bash
npm run db:push
```

## Alternative Compose Setup

`docker-compose.coolify.yml` is included if you prefer Coolify's Docker Compose build pack. It expects the same environment variables and persists uploads in a named volume.

For the public domain in Coolify, point the service to internal port `5000`.
