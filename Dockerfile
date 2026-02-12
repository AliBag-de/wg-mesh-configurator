FROM node:18-alpine

# Install wireguard-tools for 'wg' command
RUN apk add --no-cache wireguard-tools

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production server
ENV NODE_ENV=production
ENV PORT=3000
# Restrict to localhost by default (can be overridden in docker-compose)
ENV HOSTNAME=127.0.0.1 

CMD ["npm", "start"]
