FROM node:22-alpine AS builder

WORKDIR /app

COPY ./frontend/package*.json ./

RUN npm ci

COPY ./frontend .

RUN rm -rf ./public/uploads && mkdir -p ./public/uploads

RUN npm run build

FROM nginx:alpine

COPY .docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY .docker/frontend/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

ENTRYPOINT ["/entrypoint.sh"]
