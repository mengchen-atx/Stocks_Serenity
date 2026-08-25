FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx prisma generate

CMD ["npx", "tsx", "scripts/stream-daemon.ts"]
