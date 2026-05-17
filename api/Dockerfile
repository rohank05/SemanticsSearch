FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY src ./src
CMD ["sh", "-c", "node src/migrations/run.js && node src/index.js"]
