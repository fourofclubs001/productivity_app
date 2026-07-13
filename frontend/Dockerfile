FROM node:22-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

FROM base AS dev
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS prod
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
CMD ["npm", "run", "preview", "--", "--host", "--port", "5173"]
