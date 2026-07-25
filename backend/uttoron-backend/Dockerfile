FROM node:22-slim

# The feedback-stuck-tracking feature shells out to python3 + python-pptx —
# the base Node image doesn't have Python, so it's installed explicitly here
# rather than relying on whatever the host happens to provide.
RUN apt-get update && apt-get install -y python3 python3-pip --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pip3 install --break-system-packages -r scripts/requirements.txt
RUN pnpm run build

ENV PORT=3000
ENV PYTHON_BIN=python3
EXPOSE 3000

CMD ["pnpm", "run", "start"]
