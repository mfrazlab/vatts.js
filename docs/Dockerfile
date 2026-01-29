FROM node:25-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install

EXPOSE 80
EXPOSE 443

CMD ["pnpm", "start"]
