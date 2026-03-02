FROM node:18-alpine
# Install wireguard-tools for 'wg' command and openssh-client for remote deployments
RUN apt-get update && apt-get install -y --no-install-recommends wireguard-tools openssh-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start"]
