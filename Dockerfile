FROM node:25-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install
RUN pnpm build

WORKDIR /app/docs

RUN pnpm install

EXPOSE 3000

CMD ["pnpm", "start"]
