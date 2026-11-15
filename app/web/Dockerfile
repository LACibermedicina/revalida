FROM node:20-alpine AS build
WORKDIR /app
COPY web/package.json ./
RUN npm install
COPY web/index.html web/vite.config.js ./
COPY web/src ./src
# arquivos estáticos (Epi 3D, imagens, fundo, ícones): sem esta linha nada de public/ ia para o site
COPY web/public ./public
RUN npm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# versão smartwatch (estática): acessível em /watch/
COPY watch/index.html watch/app.js watch/logica.js watch/manifest.json /usr/share/nginx/html/watch/
EXPOSE 80
