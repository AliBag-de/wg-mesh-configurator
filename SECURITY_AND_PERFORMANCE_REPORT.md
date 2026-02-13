# Security and Performance Analysis Report

This report contains security and performance issues identified as a result of the review conducted on the `wg-mesh-config` project.

## 🛡️ Security Issues

### 1. Deterministic PSK Generation (Critical)
- **File:** `lib/psk.ts`
- **Issue:** WireGuard Pre-Shared Key (PSK) generation relies solely on node names and a fixed “seed” value (`wg-mesh-psk::...`).
- **Risk:** An attacker who knows the node names can easily calculate all PSKs for the network. This completely nullifies the additional security layer (Quantum Resistance) provided by the PSK.
- **Recommendation:** A cryptographically secure random number generator (CSPRNG) should be used for PSK generation, and it must be unique for each pair.

### 2. Unprotected API Endpoint (High)
- **File:** `app/api/generate/route.ts`
- **Issue:** There is no authentication, authorization, or rate limiting on the `/api/generate` endpoint.
- **Risk:** Unauthorized individuals can use the API to overload the server (DoS) or generate network configurations.
- **Recommendation:** Authentication should be added to the endpoint, and the number of requests should be limited using middleware such as `express-rate-limit`.

### 3. Lack of Input Validation (Medium)
- **File:** `app/api/generate/route.ts`
- **Issue:** The incoming request body is directly converted to the `GeneratePayload` type. Although the `zod` library is present in the project, runtime validation is not performed on this endpoint.
- **Risk:** Incorrect or malicious data (e.g., very large numbers, missing fields) could cause the application to crash or behave unexpectedly.
- **Recommendation:** Incoming data should be validated using `zod` schemas.

### 4. Docker Security Configuration (Medium)
- **File:** `Dockerfile`, `docker-compose.yml`
- **Issues:**
- The container runs as the `root` user by default.
    - Because the `.dockerignore` file is missing, unnecessary/sensitive files such as `node_modules`, `.git`, and `.env` are copied into the image.
- `network_mode: host` and `CAP_NET_ADMIN` permissions grant the container very broad access.
    - The `/etc/wireguard` directory is mounted inside the container.
- **Risk:** If the container is compromised, an attacker could gain extensive privileges on the host system and access WireGuard keys.
- **Recommendation:** If possible, use a non-root user (e.g., `node`) and add a `.dockerignore` file.

### 5. Suspicious Dependency Versions (Low)
- **File:** `package.json`
- **Issue:** The `zod` version is specified as `^4.3.6` and the `tailwindcss` version as `^4.x`. These differ from the standard versions.
- **Risk:** Stability issues or unexpected bugs may occur.

---

## 🚀 Performance Issues

### 1. Synchronous Blocking Operations (Critical)
- **File:** `app/api/generate/route.ts`, `lib/generate.ts`
- **Issue:** Key generation (`x25519`) and ZIP compression operations run synchronously (blocking) on the Node.js main thread.
- **Risk:** During this operation, the server cannot respond to other requests (Event Loop Blocking). The server locks up during heavy usage.
- **Recommendation:** These operations should be moved to Worker Threads or asynchronous versions should be used.

### 2. Unlimited Payload (High)
- **File:** `app/api/generate/route.ts`
- **Issue:** There is no upper limit on the number of nodes/clients sent to the API.
- **Risk:** A large payload (e.g., 10,000 nodes) can cause the server to run out of memory (Out-Of-Memory).
- **Recommendation:** The maximum number of nodes/clients should be limited.

### 3. Client-Side Render Performance (Medium)
- **File:** `components/features/TopologyView.tsx`, `NodeTable.tsx`
- **Issue:**
    - `TopologyView`: SVG and `framer-motion` animations will slow down the browser on large networks (100+ nodes).
    - `NodeTable`: The entire table is re-rendered on every keyboard input. There is no virtualization.
- **Risk:** User experience will be significantly degraded on large networks.
- **Recommendation:** Virtualization should be implemented using libraries such as `react-window`, and unnecessary renders should be prevented using `memo`.

### 4. LocalStorage Synchronous Writing (Low)
- **File:** `lib/store.ts`
- **Issue:** The `zustand` persist middleware writes synchronously to `localStorage` on every state change.
- **Risk:** May cause jank in the interface with large data sets.


Translated with DeepL.com (free version)
