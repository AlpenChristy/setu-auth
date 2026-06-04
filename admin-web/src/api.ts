const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const API_BASE = isLocal
  ? "http://localhost:8001"
  : "https://setuauth-backend.setuauth-backendishasolanki0225.workers.dev";

export default API_BASE;
