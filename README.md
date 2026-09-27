# ⚡ LiveGrid

### Real-time collaborative territory on a shared 20×20 grid.

LiveGrid is a real-time multiplayer web application where users can claim cells on a shared 20×20 digital territory.

Every claim is persisted in PostgreSQL and instantly synchronized with every connected user using WebSockets.

> **Claim a cell. Build your territory. Watch the grid evolve live.**

---

## ✨ Live Demo

🚀 **Live Demo:** Coming soon

📦 **GitHub:**  
https://github.com/muskan0505/live-grid

---

## 🎯 What is LiveGrid?

Imagine a digital world made of **400 cells**.

Every connected player receives a unique anonymous identity and can claim any available cell.

Once a cell is claimed:

- 🎨 It receives the player's color
- 🔒 It becomes unavailable to other players
- ⚡ The change is broadcast in real time
- 🏆 The leaderboard updates
- 📊 Global statistics update
- 💾 The ownership is permanently stored in PostgreSQL

Multiple users can open LiveGrid at the same time and interact with the same shared world.



---

# 🚀 Features

### 🌐 Real-Time Collaboration

Every connected client receives grid updates through WebSockets.

When one player claims a cell:

```text
Player A
   │
   │ Click cell
   ▼
React Frontend
   │
   │ POST /grid/claim
   ▼
FastAPI
   │
   │ Atomic database update
   ▼
PostgreSQL
   │
   │ Claim confirmed
   ▼
WebSocket Manager
   │
   ├──────────────► Player A
   ├──────────────► Player B
   ├──────────────► Player C
   └──────────────► Player D
