FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

CMD ["npx", "tsx", "scripts/stream-daemon.ts"]
