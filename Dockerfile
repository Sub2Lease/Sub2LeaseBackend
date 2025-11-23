FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-writer-nogui \
        fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "start"]