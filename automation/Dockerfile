FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
