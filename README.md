# 🕸️ WG Mesh Configurator

**WG Mesh Configurator** is a modern, web-based tool to generate, manage, and monitor **WireGuard Mesh Networks**. It simplifies the complex task of creating full-mesh or hub-and-spoke configurations and provides real-time status monitoring of your peers.

![Dashboard Preview](https://your-screenshot-url-here.com)

## ✨ Features

- **🎨 Visual Mesh Builder**: Define standard Nodes (Gateways) and Clients (Phones/Laptops) with a clean UI.
- **🔗 Topology View**: Visualize your network structure with an interactive graph.
- **⚡ Live Status Monitoring**: See real-time "Online/Offline" status and data transfer usage for every peer (requires Docker host access).
- **📱 QR Code Support**: Instantly scan configurations for mobile clients (iOS/Android) directly from the dashboard.
- **🛠️ Auto-Configuration**: 
  - Automatically generates **Private/Public Keys** (Curve25519).
  - Assigns IPs automatically based on your CIDR.
  - Handles **Babeld** routing configurations for dynamic mesh routing.
- **📦 Zero-Dependency Export**: Generates a `.zip` file with individual `.conf` files for every peer.
- **🔒 Secure & Private**: Runs entirely locally or on your server. No external databases required.

## 🚀 Getting Started

### Option 1: Docker (Recommended for Monitoring)
Run the application on your WireGuard server to enable Live Status monitoring.

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/wg-mesh-config.git
    cd wg-mesh-config
    ```

2.  Start the container:
    ```bash
    docker-compose up -d --build
    ```

3.  Access the dashboard:
    *   **Secure Mode**: The app binds to `127.0.0.1` by default for security.
    *   Access via SSH Tunnel: `ssh -L 3000:127.0.0.1:3000 user@your-server`
    *   Open `http://localhost:3000` in your browser.

### Option 2: Local Development
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run the development server:
    ```bash
    npm run dev
    ```

## 🛠️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **UI Architecture**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Visualization**: [React Force Graph](https://github.com/vasturiano/react-force-graph)
- **Cryptography**: [@noble/curves](https://github.com/paulmillr/noble-curves) (Ed25519/X25519)

## 🗺️ Roadmap

Here are some features planned for future releases:
- [ ] **Traffic Charts**: Historical data usage graphs.
- [ ] **Multi-Interface Support**: Manage `wg0`, `wg1` etc. simultaneously.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
