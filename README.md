<!-- Awesome README in HTML Format -->

<h1 align="center">🎯 4 in a Row — Real-Time Multiplayer Game</h1>
<p align="center"><strong>Backend Engineering Intern Assignment</strong></p>

<p align="center">
  A real-time, strategy-based multiplayer Connect Four game built using 
  <strong>Node.js, WebSockets, React (Vite), and PostgreSQL</strong>.
</p>

<p align="center">
  Play against real players or challenge a <strong>strategic bot</strong> that makes smart moves — not random ones.
</p>

<p align="center">
  👉 <strong>Live Demo:</strong><br>
  <a href="https://four-in-row-2.onrender.com/" target="_blank">https://four-in-row-2.onrender.com/</a>
</p>

---

<h2>🚀 Tech Stack</h2>

<table>
  <tr>
    <th>Area</th>
    <th>Technology Used</th>
  </tr>
  <tr><td>Backend</td><td>Node.js, Express, WebSockets</td></tr>
  <tr><td>Frontend</td><td>React + Vite</td></tr>
  <tr><td>Database</td><td>PostgreSQL (Render Cloud)</td></tr>
  <tr><td>Real-time</td><td>WebSocket-based communication</td></tr>
  <tr><td>Deployment</td><td>Render (Backend & Frontend)</td></tr>
  <tr><td>Bot Logic</td><td>Minimax-style heuristic (Block + Win strategy)</td></tr>
  <tr><td>(Upcoming) Analytics</td><td>Kafka Integration for gameplay metrics</td></tr>
</table>

---

<h2>🧠 Game Objective</h2>
<ul>
  <li>Modern implementation of classic <strong>Connect Four</strong>.</li>
  <li>Players drop discs into a <strong>7×6 grid</strong>.</li>
  <li>First to connect <strong>4 discs</strong> vertically, horizontally, or diagonally wins.</li>
  <li>If grid is full and no one wins → <strong>Draw</strong>.</li>
</ul>

---

<h2>✨ Core Features</h2>

<h3>✅ 1. Real-Time Multiplayer Matchmaking</h3>
<ul>
  <li>Enter username and join matchmaking.</li>
  <li>If another player joins → game starts.</li>
  <li>If no player joins within <strong>10s</strong> → play vs <strong>Strategic Bot</strong>.</li>
</ul>

<h3>✅ 2. Smart Competitive Bot</h3>
<ul>
  <li>❌ Blocks opponent's winning move.</li>
  <li>✅ Creates self-winning opportunities.</li>
  <li>🎯 Uses heuristics, not random moves.</li>
</ul>

<h3>✅ 3. Real-Time Gameplay with WebSockets</h3>
<p>Both players see moves instantly — turn-by-turn updates.</p>

<h3>✅ 4. Rejoin Mechanism</h3>
<ul>
  <li>Disconnected players can rejoin within <strong>30 seconds</strong> using username or game ID.</li>
  <li>If not → opponent/bot wins automatically.</li>
</ul>

<h3>✅ 5. Leaderboard</h3>
<ul>
  <li>Stores game data in <strong>PostgreSQL</strong>.</li>
  <li>Displays player rankings based on wins.</li>
</ul>

---

<h2>🎯 Upcoming (Bonus): Kafka-Based Analytics</h2>
<p>Kafka Consumer (Analytics Service) will track:</p>
<ul>
  <li>⏱ Average game duration</li>
  <li>🏆 Most frequent winners</li>
  <li>📊 Games per day/hour</li>
  <li>👤 Player-specific insights</li>
</ul>
<p><em>⚙️ Currently in progress — coming soon!</em></p>

---

<h2>🖥 Frontend UI Overview</h2>
<ul>
  <li>Built using <strong>React + Vite</strong></li>
  <li>Username input & matchmaking screen</li>
  <li>Interactive <strong>7×6 game board</strong></li>
  <li>Real-time bot/player moves</li>
  <li>Win/Loss/Draw popups</li>
  <li>Leaderboard section</li>
</ul>

---

<h2>📂 Project Structure</h2>

```text
/backend
 ├── game/
 │    ├── logic.js           # Game rules & win conditions
 │    ├── bot.js             # Strategic bot logic
 ├── matchmaking.js          # Player/bot matchmaking
 ├── ws.js                   # WebSocket event handlers
 ├── storage/                # Database queries & models
 └── server.js               # Entry point

/frontend
 ├── src/
 │    ├── components/
 │    │     ├── Board.jsx
 │    │     ├── Login.jsx
 │    │     ├── Leaderboard.jsx
 │    ├── hooks/useC4Socket.js
 │    └── App.jsx
 └── index.html
```

<h2>⚙️ Local Setup & Installation</h2> <h3>🔹 1. Clone the repository</h3>
git clone https://github.com/your-username/4-in-a-row.git
cd 4-in-a-row

<h3>🔹 2. Backend Setup</h3>
cd backend
npm install
# Add PostgreSQL credentials in .env file
npm run dev       # or node server.js

<h3>🔹 3. Frontend Setup</h3>
cd frontend
npm install
npm run dev

<h2>🧪 API & WebSocket Events</h2> <table> <tr><th>Event Type</th><th>Description</th></tr> <tr><td>matchFound</td><td>Opponent or bot matched</td></tr> <tr><td>state</td><td>Broadcast game state</td></tr> <tr><td>move</td><td>Player drops a disc</td></tr> <tr><td>result</td><td>Game win/loss/draw</td></tr> <tr><td>rejoinSuccess</td><td>Player rejoined the game</td></tr> <tr><td>rejoinFailed</td><td>Rejoin attempt failed</td></tr> </table>
<h2>🤝 Contributing</h2> <p>Contributions are welcome! You can suggest features like:</p> <ul> <li>Advanced Bot (Minimax + Alpha-Beta Pruning)</li> <li>Spectator Mode</li> <li>UI Animations</li> <li>Kafka Analytics Dashboard</li> </ul> <p>Feel free to open an issue or submit a pull request.</p>
<h2>📜 License</h2> <p>MIT License © 2025 — <strong>Dharma Teja</strong></p>
<h2>⭐ Show Support</h2> <p>If you enjoyed this project, consider ⭐ starring the repository or sharing it!</p>
