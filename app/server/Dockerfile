FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY data ./data
COPY migracoes ./migracoes
EXPOSE 3001
CMD ["node", "src/index.js"]
