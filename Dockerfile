# Development image for the local mock server (npm run dev).
# The app itself is static and has no dependencies; this only pins the Node version
# used by the tooling in tools/scripts and provides openssl for a fallback certificate.
FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=development

# The repository is bind-mounted at /app by docker-compose.yml.
CMD ["npm", "run", "dev"]
