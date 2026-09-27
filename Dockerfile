FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

RUN npm ci && npm ci --prefix client

COPY . .

RUN npm run build --prefix client

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "start"]
