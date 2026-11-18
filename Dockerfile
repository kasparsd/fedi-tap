# Development image for the Vite dev server with the mock ActivityPub and OAuth server (npm run dev).
# It pins the Node version, installs the dependencies for Linux (the host's node_modules are for
# macOS and are hidden by a volume in docker-compose.yml) and provides openssl for a fallback certificate.
FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci

# The repository is bind-mounted at /app by docker-compose.yml.
CMD ["npm", "run", "dev"]
