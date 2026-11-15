import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const HUB_HOST = "status.mooncellar.test";
const API_HOST = "api.mooncellar.test";
const WEB_PORT = 3000;
const API_PORT = 3228;
const MONGO_PORT = 27017;

const HOSTS_LINE = `127.0.0.1 ${HUB_HOST} ${API_HOST}`;
const HUB_ORIGIN = `http://${HUB_HOST}:${WEB_PORT}`;
const API_ORIGIN = `http://${API_HOST}:${API_PORT}`;
const LOCAL_ORIGIN = "http://localhost:3000";

const isCheckOnly = process.argv.includes("--check");

const fail = (message: string): never => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const isPortOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });

    const settle = (isOpen: boolean) => {
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(700);
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
    socket.once("timeout", () => settle(false));
  });

const hostsHas = (content: string, host: string) =>
  new RegExp(`(^|\\s)${host.replace(/\./g, "\\.")}(\\s|$)`, "m").test(content);

const ensureHosts = () => {
  const content = readFileSync("/etc/hosts", "utf8");

  if (hostsHas(content, HUB_HOST) && hostsHas(content, API_HOST)) return;

  if (isCheckOnly) {
    fail(`/etc/hosts is missing "${HOSTS_LINE}".`);
  }

  console.log(
    `The hub is reached by host, so both names must resolve:\n  ${HOSTS_LINE}`
  );

  const answer =
    prompt("Add the line to /etc/hosts now (asks for your password)? [Y/n]") ??
    "";

  if (answer.trim().toLowerCase().startsWith("n")) {
    fail(`Add it by hand:\n  echo "${HOSTS_LINE}" | sudo tee -a /etc/hosts`);
  }

  const result = spawnSync(
    "sudo",
    ["sh", "-c", `printf '%s\\n' '${HOSTS_LINE}' >> /etc/hosts`],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    fail(
      `Could not write /etc/hosts. Add it by hand:\n  echo "${HOSTS_LINE}" | sudo tee -a /etc/hosts`
    );
  }
};

const ensurePortFree = async (port: number, label: string) => {
  if (await isPortOpen(port)) {
    fail(
      `${label} is already listening on port ${port}. Stop it first: the hub opens on ${HUB_ORIGIN}.`
    );
  }
};

const ensureMongo = async () => {
  if (await isPortOpen(MONGO_PORT)) return;

  fail(
    `No MongoDB on 127.0.0.1:${MONGO_PORT}.\n` +
      "  Start the tunnel with `bun run mongo` (that is the production database) or run a local one."
  );
};

ensureHosts();

await Promise.all([
  ensurePortFree(WEB_PORT, "Something"),
  ensurePortFree(API_PORT, "The API"),
  ensureMongo(),
]);

if (isCheckOnly) {
  console.log(`Ready: ${HUB_ORIGIN} (API on ${API_ORIGIN}).`);
  process.exit(0);
}

console.log(`\nHub: ${HUB_ORIGIN}\nAPI: ${API_ORIGIN}\n`);
console.log(
  "The API uses the database apps/api/.env points at. With `bun run mongo` that is production, where DISABLE_CRONS=true keeps the crons off.\n"
);

const children = [
  spawn("bun", ["--filter", "api", "start:dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      LOCAL_CONNECTION: [HUB_ORIGIN, LOCAL_ORIGIN].join(","),
    },
  }),
  spawn("bun", ["--filter", "web", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      INTERNAL_API_URL: API_ORIGIN,
    },
  }),
];

let isStopping = false;

const stop = (code = 0) => {
  if (isStopping) return;
  isStopping = true;

  for (const child of children) child.kill("SIGINT");
  process.exit(code);
};

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

for (const child of children) {
  child.on("exit", (code) => {
    if (code) stop(code);
  });
}
