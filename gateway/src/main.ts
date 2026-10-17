import { buildServer } from "./server.js";
const port = Number(process.env.S14_GATEWAY_PORT ?? 8800);
buildServer().listen(port, () => console.log(`gateway on :${port}`));
