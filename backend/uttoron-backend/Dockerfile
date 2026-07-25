FROM node:22-slim

# The feedback-stuck-tracking feature shells out to python3 + python-pptx —
# the base Node image doesn't have Python, so it's installed explicitly here
# rather than relying on whatever the host happens to provide.
RUN apt-get update && apt-get install -y python3 python3-pip --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Pinned to the exact version this project has been developed/tested
# against — an unpinned "latest" pnpm can add new strict-by-default
# behaviors (like the native-build-script approval gate below) that never
# showed up locally.
RUN npm install -g pnpm@11.10.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
# Belt-and-suspenders: force bcrypt's native build explicitly, in case the
# onlyBuiltDependencies setting above isn't honored the same way by every
# pnpm version — this is a deliberate, direct action that isn't subject to
# the automatic-install-time approval gate.
RUN pnpm rebuild bcrypt

COPY . .
RUN pip3 install --break-system-packages -r scripts/requirements.txt
RUN pnpm run build

ENV PORT=3000
ENV PYTHON_BIN=python3
EXPOSE 3000

CMD ["pnpm", "run", "start"]
