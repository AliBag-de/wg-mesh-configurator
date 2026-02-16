# 🕸️ WG Mesh Configurator

**WG Mesh Configurator** is a modern, web-based orchestration tool for **WireGuard Mesh Networks**. It automates the complex process of generating, distributing, and installing WireGuard configurations across multiple remote servers.

---

## ✨ Key Features

- **🎨 Visual Mesh Builder**: Define standard Nodes (Gateways) and Clients with a specialized UI.
- **� One-Click Remote Deploy**: Push configurations directly to remote servers via SSH. No manual file transfer needed.
- **🔄 Batch Deployment**: Deploy to your entire mesh network sequentially with real-time logs and progress tracking.
- **🔑 SSH Integration**: Automatically parses your `~/.ssh/config` for easy host selection and credential auto-fill.
- **🔗 Intelligent Topology**: Automatically generates full-mesh routing tables and Babeld dynamic routing configs.
- **🛡️ Secure Manual Flow**: Provides copy-pasteable commands for servers requiring manual intervention, uploading assets to `/tmp` securely.
- **📱 QR Code Support**: Instant configuration for mobile peers.

---

## 📋 Requirements

### Target Servers (Nodes)
To use the **Remote Deployment** feature, target servers must have:
- **OS**: Linux (Ubuntu/Debian recommended).
- **Packages**: `wireguard-tools` must be installed (`sudo apt install wireguard-tools`).
- **Sudo Access**: The SSH user must have `sudo` privileges to apply network changes.
- **Optional**: `babeld` for dynamic routing if mesh routing is enabled.

### Orchestrator (Where this app runs)
- **Node.js**: v18 or later.
- **SSH Access**: Passwordless SSH (SSH Keys) configured for all target nodes.

---

## 🚀 Usage Guide

### 1. Define Your Network
1.  **Network CIDR**: Set your internal mesh network range (e.g., `10.20.0.0/24`).
2.  **Add Nodes**: Enter names for your servers.
    *   **WG Endpoint**: The public IP/Domain other nodes will connect to.
    *   **SSH Host**: The IP or Alias (from `~/.ssh/config`) used for management.
3.  **SSH Credentials**: Click the **User/Port** fields in the table to specify node-specific credentials.

### 2. Deploy Configurations

#### Single Node Deploy
1. Click the **"Install on Remote Server"** button in the sidebar.
2. Select your target node.
3. Review the auto-filled SSH details and click **"Start Deployment"**.

#### Batch (All Nodes) Deploy
1. Ensure all nodes have **SSH Host**, **User**, and **Port** defined.
2. Click the **"Deploy to All Remote"** button.
3. Monitor the real-time execution in the high-style deployment modal.

---

## 🛠️ Installation

### Docker (Recommended)
```bash
docker-compose up -d --build
```

### Local Development
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`

---

## 🔐 Security Information
- **Credential Handling**: This application **does not save** your SSH credentials in persistent storage. They are used only during the active browser session.
- **Config Privacy**: All keys are generated locally in your browser/server instance. No data is sent to external APIs except your own target nodes.

---

## 📄 License
MIT License. Created with ❤️ for the WireGuard community.
