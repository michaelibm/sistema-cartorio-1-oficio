# Dockerfile para Frontend React
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci

COPY . .

# ⬅️ ADICIONAR ISSO - recebe a variável no momento do build
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Stage 2: Serve com nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]