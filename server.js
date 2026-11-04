const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// In-Memory Global Rooms Registry
const rooms = {};

// Enable CORS for external local IP access
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic API status endpoint
app.get('/api/status', (req, res) => {
  const activeRooms = Object.keys(rooms).length;
  let totalPlayers = 0;
  for (const r in rooms) {
    totalPlayers += Object.keys(rooms[r].players).length;
  }
  res.json({
    status: 'ONLINE',
    game: 'Impostor Techno',
    version: '1.0.0',
    activeRooms,
    totalPlayers,
    uptime: process.uptime()
  });
});

// Setup Socket.IO with WebSocket and Polling fallbacks
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000
});

// =============================================================================
// GAME CONSTANTS & MAP METRICS
// =============================================================================
const TICK_RATE = 20; // 20 updates per second for smooth state sync
const MAP_WIDTH = 1400;
const MAP_HEIGHT = 1050;
const PLAYER_SPEED = 240; // pixels per second
const KILL_COOLDOWN_DEFAULT = 25; // seconds
const SABOTAGE_COOLDOWN_DEFAULT = 30; // seconds
const SABOTAGE_COUNTDOWN_MAX = 40; // seconds before Impostor auto-wins
const MEETING_TIMER_MAX = 40; // seconds for discussion & vote

// 8 Distinct Developer Identity Colors
const PLAYER_COLORS = [
  { name: 'Cyan Dev', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  { name: 'Emerald Sysadmin', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  { name: 'Amber DevOps', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  { name: 'Rose Tester', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
  { name: 'Violet Architect', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
  { name: 'Indigo Lead', hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  { name: 'Sky Frontend', hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
  { name: 'Lime Security', hex: '#84cc16', glow: 'rgba(132, 204, 22, 0.4)' }
];

// Office Rooms & Landmarks for navigation & radar
const ROOMS_INFO = [
  { id: 'war-room', name: '🚨 INCIDENT WAR ROOM', x: 700, y: 220, w: 420, h: 260 },
  { id: 'dev-cubicles', name: '💻 DEV OPEN SPACE', x: 260, y: 440, w: 380, h: 420 },
  { id: 'server-room', name: '⚡ SERVER RACK ROOM', x: 1140, y: 440, w: 380, h: 420 },
  { id: 'pantry', name: '☕ TECH PANTRY & LOUNGE', x: 700, y: 840, w: 440, h: 280 }
];

// 4 Interactive Task Stations
const TASK_DEFINITIONS = [
  {
    id: 'task-patch-cord',
    title: 'Fix Switch & Patch Cord',
    room: 'Server Room',
    desc: 'Sambungkan kabel LAN 10GbE sesuai warna port switch.',
    x: 1250,
    y: 560,
    radius: 55
  },
  {
    id: 'task-deploy-hotfix',
    title: 'Deploy Hotfix ke Production',
    room: 'Dev Open Space',
    desc: 'Validasi commit, jalankan test suite, dan swipe deploy.',
    x: 180,
    y: 350,
    radius: 55
  },
  {
    id: 'task-restock-coffee',
    title: 'Restock Biji Kopi Pantry',
    room: 'Tech Pantry',
    desc: 'Tekan dan tahan tuas espresso sampai mug terisi optimal.',
    x: 550,
    y: 770,
    radius: 55
  },
  {
    id: 'task-restart-router',
    title: 'Restart Core Router',
    room: 'Server Room',
    desc: 'Inisiasi hard reboot router & tunggu flushing tabel ARP (5s).',
    x: 1250,
    y: 330,
    radius: 55
  }
];

// Sabotage Console (in Server Room) to resolve Kernel Panic
const SABOTAGE_TERMINAL = {
  id: 'terminal-kernel-panic',
  name: 'Main Server Console',
  x: 1060,
  y: 330,
  radius: 65
};

// Emergency Meeting Button (Center of War Room table)
const EMERGENCY_BUTTON = {
  id: 'emergency-button',
  name: 'Emergency Meeting Button',
  x: 700,
  y: 220,
  radius: 150
};

// Vents in Server Racks & Ducts
const VENTS = [
  { id: 'vent-server', name: 'Rack Vent Alpha', x: 1240, y: 590, connectedTo: ['vent-dev', 'vent-pantry'] },
  { id: 'vent-dev', name: 'Cable Duct Beta', x: 170, y: 600, connectedTo: ['vent-server', 'vent-pantry'] },
  { id: 'vent-pantry', name: 'Air Shaft Gamma', x: 860, y: 920, connectedTo: ['vent-server', 'vent-dev'] }
];

// In-room solid obstacles (tables, server racks, printer)
const OBSTACLES = [
  // War room conference table
  { x: 600, y: 180, w: 200, h: 80 },
  // Dev desks
  { x: 190, y: 340, w: 160, h: 70 },
  { x: 190, y: 520, w: 160, h: 70 },
  // Server racks
  { x: 1080, y: 390, w: 70, h: 180 },
  { x: 1180, y: 390, w: 70, h: 180 },
  // Pantry counter
  { x: 620, y: 810, w: 160, h: 60 },
  // Smoking printer
  { x: 1230, y: 540, w: 46, h: 50 }
];

// Helper: Check if point is inside playable geometry
function isPositionWalkable(x, y, isGhost = false) {
  // Boundaries of the office
  if (x < 70 || x > MAP_WIDTH - 70 || y < 90 || y > MAP_HEIGHT - 70) {
    return false;
  }
  // Ghosts can move through any obstacle
  if (isGhost) return true;

  // Solid obstacles check
  for (const obs of OBSTACLES) {
    if (x >= obs.x && x <= obs.x + obs.w && y >= obs.y && y <= obs.y + obs.h) {
      return false;
    }
  }
  return true;
}

// Helper: Get spawn positions around War Room
function getSpawnPosition(index, total) {
  const centerX = 700;
  const centerY = 220;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    x: Math.round(centerX + Math.cos(angle) * 140),
    y: Math.round(centerY + Math.sin(angle) * 85)
  };
}

// Helper: Calculate distance
function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Helper: Generate 5-character unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =============================================================================
// MAIN SERVER GAME TICK & AUTHORITATIVE LOGIC
// =============================================================================
setInterval(() => {
  const now = Date.now();

  for (const roomCode in rooms) {
    const room = rooms[roomCode];

    // Tick Sabotage if active
    if (room.state === 'PLAYING' && room.sabotage.active) {
      room.sabotage.remainingSeconds = Math.max(
        0,
        Math.ceil((room.sabotage.expiresAt - now) / 1000)
      );

      // Impostor wins if timer runs out!
      if (room.sabotage.remainingSeconds <= 0) {
        endGame(room, 'IMPOSTOR', 'SABOTAGE_TIMEOUT');
        continue;
      }
    }

    // Tick Emergency Meeting Timer if active
    if (room.state === 'MEETING') {
      room.meeting.remainingSeconds = Math.max(
        0,
        Math.ceil((room.meeting.expiresAt - now) / 1000)
      );

      // Check if all alive players have voted or timer expired
      const alivePlayers = Object.values(room.players).filter((p) => p.isAlive);
      const totalVotesCast = Object.keys(room.meeting.votes).length;

      if (room.meeting.remainingSeconds <= 0 || totalVotesCast >= alivePlayers.length) {
        concludeMeeting(room);
      }
    }

    // Decrement kill cooldowns for impostors
    if (room.state === 'PLAYING') {
      for (const pId in room.players) {
        const p = room.players[pId];
        if (p.role === 'impostor' && p.killCooldown > 0) {
          p.killCooldown = Math.max(0, p.killCooldown - 1 / TICK_RATE);
        }
      }
    }

    // Broadcast state snapshot to all room participants
    io.to(roomCode).emit('game_tick', {
      state: room.state,
      players: serializePlayers(room.players),
      bodies: room.bodies,
      sabotage: room.sabotage,
      meeting: room.meeting.active ? {
        caller: room.meeting.caller,
        reason: room.meeting.reason,
        bodyVictim: room.meeting.bodyVictim,
        remainingSeconds: room.meeting.remainingSeconds,
        votes: room.meeting.votes,
        votedList: Object.keys(room.meeting.votes)
      } : null,
      totalTasksProgress: room.totalTasksRequired > 0
        ? Math.min(100, Math.round((room.totalTasksCompleted / room.totalTasksRequired) * 100))
        : 0
    });
  }
}, 1000 / TICK_RATE);

// Sanitize player information for public broadcast (keep role secret until game over or meeting outcome)
function serializePlayers(playersMap) {
  const list = {};
  for (const id in playersMap) {
    const p = playersMap[id];
    list[id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      isAlive: p.isAlive,
      isGhost: !p.isAlive,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      facing: p.facing,
      inVent: p.inVent,
      tasksCompletedCount: p.tasksCompleted ? p.tasksCompleted.length : 0,
      isBot: !!p.isBot
    };
  }
  return list;
}

// Conclude Meeting and Tally Votes
function concludeMeeting(room) {
  room.state = 'MEETING_RESULTS';
  room.meeting.active = false;

  const tally = {};
  for (const voterId in room.meeting.votes) {
    const target = room.meeting.votes[voterId];
    tally[target] = (tally[target] || 0) + 1;
  }

  let highestVotes = 0;
  let candidateToEject = null;
  let isTie = false;

  for (const candidate in tally) {
    const count = tally[candidate];
    if (count > highestVotes) {
      highestVotes = count;
      candidateToEject = candidate;
      isTie = false;
    } else if (count === highestVotes) {
      isTie = true;
    }
  }

  let ejectionResult = {
    ejected: null,
    wasImpostor: false,
    isTie: isTie,
    isSkipped: candidateToEject === 'SKIP' || !candidateToEject
  };

  if (!isTie && candidateToEject && candidateToEject !== 'SKIP') {
    const ejectedPlayer = room.players[candidateToEject];
    if (ejectedPlayer && ejectedPlayer.isAlive) {
      ejectedPlayer.isAlive = false;
      ejectionResult.ejected = {
        id: ejectedPlayer.id,
        name: ejectedPlayer.name,
        color: ejectedPlayer.color
      };
      ejectionResult.wasImpostor = ejectedPlayer.role === 'impostor';
    }
  }

  // Clear dead bodies after meeting
  room.bodies = [];

  // Broadcast results to room
  io.to(room.code).emit('meeting_concluded', {
    ejectionResult,
    tally,
    remainingImpostors: Object.values(room.players).filter((p) => p.isAlive && p.role === 'impostor').length
  });

  // Check win conditions
  setTimeout(() => {
    if (!checkWinConditions(room)) {
      // Return to playing state
      room.state = 'PLAYING';

      // Respawn players in War Room
      const playerList = Object.values(room.players);
      playerList.forEach((p, idx) => {
        const spawn = getSpawnPosition(idx, playerList.length);
        p.x = spawn.x;
        p.y = spawn.y;
        p.vx = 0;
        p.vy = 0;
        p.inVent = null;
        if (p.role === 'impostor') {
          p.killCooldown = KILL_COOLDOWN_DEFAULT;
        }
      });

      io.to(room.code).emit('resume_game', {
        players: serializePlayers(room.players)
      });
    }
  }, 5000);
}

// Check Win Conditions
function checkWinConditions(room) {
  if (room.state !== 'PLAYING') return false;

  const totalPlayers = Object.keys(room.players).length;

  // Solo / duo sandbox test mode: don't trigger instant game over, allow movement & testing
  if (totalPlayers < 3) {
    if (room.totalTasksRequired > 0 && room.totalTasksCompleted >= room.totalTasksRequired) {
      endGame(room, 'CREWMATES', 'TASKS_DONE');
      return true;
    }
    return false;
  }

  const alivePlayers = Object.values(room.players).filter((p) => p.isAlive);
  const aliveImpostors = alivePlayers.filter((p) => p.role === 'impostor');
  const aliveDevs = alivePlayers.filter((p) => p.role === 'dev');

  // Condition 1: All Impostors eliminated
  if (aliveImpostors.length === 0) {
    endGame(room, 'CREWMATES', 'ALL_IMPOSTORS_EJECTED');
    return true;
  }

  // Condition 2: Impostors equal or outnumber Devs
  if (aliveDevs.length === 0 || (aliveImpostors.length >= aliveDevs.length && aliveDevs.length > 0)) {
    endGame(room, 'IMPOSTOR', 'IMPOSTOR_KILL_MAJORITY');
    return true;
  }

  // Condition 3: Total Task Progress 100%
  if (room.totalTasksRequired > 0 && room.totalTasksCompleted >= room.totalTasksRequired) {
    endGame(room, 'CREWMATES', 'TASKS_DONE');
    return true;
  }

  return false;
}

// End Game
function endGame(room, winner, reason) {
  room.state = 'GAMEOVER';
  room.winner = winner;
  room.winReason = reason;

  // Reveal all roles to players
  const playerRoles = {};
  for (const id in room.players) {
    playerRoles[id] = {
      id,
      name: room.players[id].name,
      role: room.players[id].role,
      color: room.players[id].color
    };
  }

  io.to(room.code).emit('game_over', {
    winner,
    reason,
    players: playerRoles
  });
}

// =============================================================================
// SOCKET.IO EVENT HANDLERS
// =============================================================================
io.on('connection', (socket) => {
  let currentRoomCode = null;

  // 1. Create Room
  socket.on('create_room', ({ playerName, color }) => {
    const roomCode = generateRoomCode();
    currentRoomCode = roomCode;

    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.id,
      state: 'LOBBY',
      players: {},
      bodies: [],
      sabotage: {
        active: false,
        type: null,
        expiresAt: 0,
        remainingSeconds: 0,
        repairedBy: []
      },
      meeting: {
        active: false,
        caller: null,
        reason: null,
        bodyVictim: null,
        expiresAt: 0,
        remainingSeconds: 0,
        votes: {},
        chatMessages: []
      },
      totalTasksRequired: 0,
      totalTasksCompleted: 0,
      winner: null,
      winReason: null
    };

    const chosenColor = color || PLAYER_COLORS[0];
    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      name: playerName.trim().substring(0, 14) || 'Lead Dev',
      color: chosenColor,
      role: 'dev',
      isAlive: true,
      x: 700,
      y: 220,
      vx: 0,
      vy: 0,
      facing: 'right',
      inVent: null,
      killCooldown: KILL_COOLDOWN_DEFAULT,
      tasks: [],
      tasksCompleted: []
    };

    socket.join(roomCode);
    socket.emit('room_created', {
      roomCode,
      playerId: socket.id,
      isHost: true,
      players: serializePlayers(rooms[roomCode].players)
    });
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, playerName, color }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      return socket.emit('error_message', 'Ruangan tidak ditemukan! Periksa kembali kode ruangan.');
    }

    if (room.state !== 'LOBBY') {
      return socket.emit('error_message', 'Permainan sedang berlangsung di ruangan ini!');
    }

    if (Object.keys(room.players).length >= 10) {
      return socket.emit('error_message', 'Ruangan sudah penuh (Maksimal 10 pemain)!');
    }

    currentRoomCode = code;
    // Choose color from pool if already taken
    const existingColors = Object.values(room.players).map((p) => p.color.hex);
    let chosenColor = color || PLAYER_COLORS[Object.keys(room.players).length % PLAYER_COLORS.length];
    if (existingColors.includes(chosenColor.hex)) {
      chosenColor = PLAYER_COLORS.find((c) => !existingColors.includes(c.hex)) || chosenColor;
    }

    room.players[socket.id] = {
      id: socket.id,
      name: playerName.trim().substring(0, 14) || `Engineer #${Object.keys(room.players).length + 1}`,
      color: chosenColor,
      role: 'dev',
      isAlive: true,
      x: 700,
      y: 220,
      vx: 0,
      vy: 0,
      facing: 'right',
      inVent: null,
      killCooldown: KILL_COOLDOWN_DEFAULT,
      tasks: [],
      tasksCompleted: []
    };

    socket.join(code);
    socket.emit('room_joined', {
      roomCode: code,
      playerId: socket.id,
      isHost: room.hostId === socket.id,
      players: serializePlayers(room.players)
    });

    // Notify other players
    io.to(code).emit('lobby_updated', {
      players: serializePlayers(room.players),
      hostId: room.hostId
    });
  });

  // 3. Add Mock Bot Coworker (Great for testing solo or with small groups)
  socket.on('add_bot', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.hostId !== socket.id || room.state !== 'LOBBY') return;

    if (Object.keys(room.players).length >= 8) {
      return socket.emit('error_message', 'Kapasitas maksimal bot tercapai.');
    }

    const botNames = ['Sdr. Budi', 'Sdri. Siti', 'Andi Sysadmin', 'Raka DevOps', 'Maya QA', 'Dimas Intern'];
    const botId = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = botNames[Object.keys(room.players).length % botNames.length];
    const existingColors = Object.values(room.players).map((p) => p.color.hex);
    const chosenColor = PLAYER_COLORS.find((c) => !existingColors.includes(c.hex)) || PLAYER_COLORS[2];

    room.players[botId] = {
      id: botId,
      name,
      color: chosenColor,
      role: 'dev',
      isAlive: true,
      isBot: true,
      x: 700,
      y: 220,
      vx: 0,
      vy: 0,
      facing: 'right',
      inVent: null,
      killCooldown: KILL_COOLDOWN_DEFAULT,
      tasks: [],
      tasksCompleted: []
    };

    io.to(currentRoomCode).emit('lobby_updated', {
      players: serializePlayers(room.players),
      hostId: room.hostId
    });
  });

  // 4. Start Game (Host only)
  socket.on('start_game', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.hostId !== socket.id) return;

    const playerIds = Object.keys(room.players);
    if (playerIds.length < 1) {
      return socket.emit('error_message', 'Dibutuhkan minimal pemain untuk memulai game.');
    }

    // Role assignment:
    // If 1 player (solo testing): let host choose or default to impostor for sandbox test
    // If >= 2 players: randomly select 1 impostor (or 2 if >= 7)
    let impostorCount = playerIds.length >= 7 ? 2 : 1;
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const impostorIds = new Set(shuffled.slice(0, impostorCount));

    // Reset and assign tasks
    room.state = 'PLAYING';
    room.bodies = [];
    room.sabotage = {
      active: false,
      type: null,
      expiresAt: 0,
      remainingSeconds: 0,
      repairedBy: []
    };

    let totalTasksRequired = 0;

    playerIds.forEach((pId, idx) => {
      const p = room.players[pId];
      const isImpostor = impostorIds.has(pId);
      p.role = isImpostor ? 'impostor' : 'dev';
      p.isAlive = true;
      p.killCooldown = KILL_COOLDOWN_DEFAULT;
      p.inVent = null;

      // Assign all 4 tasks to Devs
      if (!isImpostor) {
        p.tasks = TASK_DEFINITIONS.map((t) => t.id);
        totalTasksRequired += p.tasks.length;
      } else {
        // Fake tasks list for Impostor to blend in
        p.tasks = TASK_DEFINITIONS.map((t) => t.id);
      }
      p.tasksCompleted = [];

      // Initial Spawn at War Room Table
      const spawn = getSpawnPosition(idx, playerIds.length);
      p.x = spawn.x;
      p.y = spawn.y;
      p.vx = 0;
      p.vy = 0;
    });

    room.totalTasksRequired = Math.max(1, totalTasksRequired);
    room.totalTasksCompleted = 0;

    // Notify each player privately of their role and tasks
    playerIds.forEach((pId) => {
      const p = room.players[pId];
      if (!p.isBot) {
        io.to(pId).emit('game_started', {
          role: p.role,
          tasks: p.tasks,
          taskDefinitions: TASK_DEFINITIONS,
          impostorTeam: p.role === 'impostor'
            ? playerIds.filter((id) => impostorIds.has(id)).map((id) => room.players[id].name)
            : [],
          spawnPos: { x: p.x, y: p.y }
        });
      }
    });

    // Broadcast global game start
    io.to(room.code).emit('game_state_changed', {
      state: 'PLAYING',
      players: serializePlayers(room.players)
    });
  });

  // 5. Player Movement Input
  socket.on('player_move', ({ x, y, vx, vy, facing }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const p = room.players[socket.id];
    if (!p) return;

    // In vent? cannot move
    if (p.inVent) return;

    // Movement validation
    if (isPositionWalkable(x, y, !p.isAlive)) {
      p.x = x;
      p.y = y;
      p.vx = vx || 0;
      p.vy = vy || 0;
      p.facing = facing || p.facing;
    }
  });

  // 6. Complete Task
  socket.on('complete_task', ({ taskId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const p = room.players[socket.id];
    if (!p) return;

    // If dev, record real completion
    if (p.role === 'dev') {
      if (!p.tasksCompleted.includes(taskId)) {
        p.tasksCompleted.push(taskId);
        room.totalTasksCompleted++;

        socket.emit('task_acknowledged', {
          taskId,
          tasksCompleted: p.tasksCompleted,
          totalProgress: Math.min(100, Math.round((room.totalTasksCompleted / room.totalTasksRequired) * 100))
        });

        checkWinConditions(room);
      }
    } else {
      // Impostor fake task
      socket.emit('task_acknowledged', {
        taskId,
        tasksCompleted: [...p.tasksCompleted, taskId],
        fake: true
      });
    }
  });

  // 7. Silent Terminate / Revoke Access (Kill)
  socket.on('kill_target', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const killer = room.players[socket.id];
    const victim = room.players[targetId];

    if (!killer || killer.role !== 'impostor' || !killer.isAlive || killer.killCooldown > 0) {
      return;
    }

    if (!victim || !victim.isAlive || victim.role === 'impostor') {
      return;
    }

    // Proximity check (must be within 100px)
    const dist = getDistance(killer.x, killer.y, victim.x, victim.y);
    if (dist > 100) {
      return;
    }

    // Eliminate victim
    victim.isAlive = false;
    killer.killCooldown = KILL_COOLDOWN_DEFAULT;

    // Teleport killer slightly towards victim for dramatic impact
    killer.x = victim.x;
    killer.y = victim.y;

    // Spawn BSOD Laptop (Dead Body)
    const body = {
      id: `body-${Date.now()}`,
      victimId: victim.id,
      victimName: victim.name,
      victimColor: victim.color,
      x: victim.x,
      y: victim.y,
      reported: false
    };
    room.bodies.push(body);

    // Notify victim privately
    if (!victim.isBot) {
      io.to(victim.id).emit('player_eliminated', {
        killerName: killer.name
      });
    }

    // Broadcast kill event sound / visual cue to players nearby
    io.to(room.code).emit('body_dropped', {
      body,
      killerId: killer.id
    });

    checkWinConditions(room);
  });

  // 8. Server Rack Vent (Hop into / move between vents)
  socket.on('vent_action', ({ action, ventId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const p = room.players[socket.id];
    if (!p || p.role !== 'impostor' || !p.isAlive) return;

    if (action === 'ENTER') {
      const vent = VENTS.find((v) => v.id === ventId);
      if (vent && getDistance(p.x, p.y, vent.x, vent.y) < 70) {
        p.inVent = vent.id;
        p.x = vent.x;
        p.y = vent.y;
        socket.emit('vent_status', { inVent: vent.id, availableVents: vent.connectedTo });
      }
    } else if (action === 'HOP') {
      if (!p.inVent) return;
      const targetVent = VENTS.find((v) => v.id === ventId);
      if (targetVent) {
        p.inVent = targetVent.id;
        p.x = targetVent.x;
        p.y = targetVent.y;
        socket.emit('vent_status', { inVent: targetVent.id, availableVents: targetVent.connectedTo });
      }
    } else if (action === 'EXIT') {
      if (!p.inVent) return;
      p.inVent = null;
      socket.emit('vent_status', { inVent: null, availableVents: [] });
    }
  });

  // 9. Sabotage Trigger (Kernel Panic)
  socket.on('trigger_sabotage', ({ type }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const p = room.players[socket.id];
    if (!p || p.role !== 'impostor' || !p.isAlive) return;

    if (room.sabotage.active) return; // Already active

    room.sabotage = {
      active: true,
      type: 'KERNEL_PANIC',
      expiresAt: Date.now() + SABOTAGE_COUNTDOWN_MAX * 1000,
      remainingSeconds: SABOTAGE_COUNTDOWN_MAX,
      repairedBy: []
    };

    io.to(room.code).emit('sabotage_started', {
      type: 'KERNEL_PANIC',
      countdown: SABOTAGE_COUNTDOWN_MAX
    });
  });

  // 10. Repair Sabotage
  socket.on('repair_sabotage', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING' || !room.sabotage.active) return;

    const p = room.players[socket.id];
    if (!p || !p.isAlive) return;

    // Check proximity to terminal
    const dist = getDistance(p.x, p.y, SABOTAGE_TERMINAL.x, SABOTAGE_TERMINAL.y);
    if (dist < 85) {
      room.sabotage = {
        active: false,
        type: null,
        expiresAt: 0,
        remainingSeconds: 0,
        repairedBy: []
      };

      io.to(room.code).emit('sabotage_resolved', {
        repairedBy: p.name
      });
    }
  });

  // 11. Call Incident War Room (Emergency Meeting or Report Body)
  socket.on('call_meeting', ({ reason, bodyId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'PLAYING') return;

    const caller = room.players[socket.id];
    if (!caller || !caller.isAlive) return;

    let bodyVictim = null;
    if (reason === 'BODY') {
      const body = room.bodies.find((b) => b.id === bodyId);
      if (!body) return;
      const dist = getDistance(caller.x, caller.y, body.x, body.y);
      if (dist > 110) return;
      bodyVictim = body.victimName;
    } else if (reason === 'BUTTON') {
      const dist = getDistance(caller.x, caller.y, EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y);
      if (dist > EMERGENCY_BUTTON.radius) return;
    }

    // Cancel active sabotage if meeting is triggered
    if (room.sabotage.active) {
      room.sabotage.active = false;
    }

    // Teleport all alive players to War Room
    const playerList = Object.values(room.players);
    playerList.forEach((p, idx) => {
      const spawn = getSpawnPosition(idx, playerList.length);
      p.x = spawn.x;
      p.y = spawn.y;
      p.vx = 0;
      p.vy = 0;
      p.inVent = null;
    });

    room.state = 'MEETING';
    room.meeting = {
      active: true,
      caller: caller.name,
      reason: reason || 'BUTTON',
      bodyVictim,
      expiresAt: Date.now() + MEETING_TIMER_MAX * 1000,
      remainingSeconds: MEETING_TIMER_MAX,
      votes: {},
      chatMessages: []
    };

    io.to(room.code).emit('meeting_started', {
      caller: caller.name,
      reason: room.meeting.reason,
      bodyVictim,
      timer: MEETING_TIMER_MAX,
      alivePlayers: playerList.filter((p) => p.isAlive).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color
      }))
    });

    // Make Bot Coworkers vote randomly after 8-15 seconds for realistic office banter!
    playerList.filter((p) => p.isBot && p.isAlive).forEach((bot) => {
      const delay = 6000 + Math.random() * 10000;
      setTimeout(() => {
        if (room.state === 'MEETING' && room.meeting.active && !room.meeting.votes[bot.id]) {
          const aliveTargets = playerList.filter((p) => p.isAlive && p.id !== bot.id).map((p) => p.id);
          aliveTargets.push('SKIP');
          const randomVote = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
          room.meeting.votes[bot.id] = randomVote;
          io.to(room.code).emit('vote_cast', {
            voterId: bot.id,
            totalVotes: Object.keys(room.meeting.votes).length
          });
        }
      }, delay);
    });
  });

  // 12. Cast Vote
  socket.on('cast_vote', ({ targetId }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'MEETING' || !room.meeting.active) return;

    const voter = room.players[socket.id];
    if (!voter || !voter.isAlive || room.meeting.votes[socket.id]) return;

    room.meeting.votes[socket.id] = targetId || 'SKIP';

    io.to(room.code).emit('vote_cast', {
      voterId: socket.id,
      totalVotes: Object.keys(room.meeting.votes).length
    });
  });

  // 13. War Room Live Chat
  socket.on('send_meeting_chat', ({ text }) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];
    if (room.state !== 'MEETING') return;

    const sender = room.players[socket.id];
    if (!sender) return;

    const cleanText = (text || '').trim().substring(0, 100);
    if (!cleanText) return;

    const msg = {
      senderId: sender.id,
      senderName: sender.name,
      senderColor: sender.color,
      isDead: !sender.isAlive,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    room.meeting.chatMessages.push(msg);
    io.to(room.code).emit('meeting_chat_received', msg);
  });

  // 14. Play Again (Host or participant resets room to Lobby)
  socket.on('play_again', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];

    room.state = 'LOBBY';
    room.bodies = [];
    room.sabotage = { active: false, type: null, expiresAt: 0, remainingSeconds: 0, repairedBy: [] };
    room.meeting = { active: false, caller: null, reason: null, bodyVictim: null, expiresAt: 0, remainingSeconds: 0, votes: {}, chatMessages: [] };
    room.totalTasksRequired = 0;
    room.totalTasksCompleted = 0;
    room.winner = null;
    room.winReason = null;

    for (const id in room.players) {
      const p = room.players[id];
      p.isAlive = true;
      p.role = 'dev';
      p.tasks = [];
      p.tasksCompleted = [];
      p.inVent = null;
      p.x = 700;
      p.y = 310;
    }

    io.to(room.code).emit('lobby_reset', {
      players: serializePlayers(room.players),
      hostId: room.hostId
    });
  });

  // 15. Disconnect handling
  socket.on('disconnect', () => {
    if (currentRoomCode && rooms[currentRoomCode]) {
      const room = rooms[currentRoomCode];
      delete room.players[socket.id];

      // If room is empty, clean it up
      if (Object.keys(room.players).length === 0) {
        delete rooms[currentRoomCode];
      } else {
        // If host left, assign new host
        if (room.hostId === socket.id) {
          room.hostId = Object.keys(room.players)[0];
        }

        io.to(currentRoomCode).emit('player_left', {
          playerId: socket.id,
          hostId: room.hostId,
          players: serializePlayers(room.players)
        });

        if (room.state === 'PLAYING') {
          checkWinConditions(room);
        }
      }
    }
  });
});

// =============================================================================
// START HTTP & WEBSOCKET LISTENER
// =============================================================================
let currentPort = Number(process.env.PORT) || 3001;

function tryListen(port) {
  function onListen() {
    server.removeListener('error', onError);
    console.log(`================================================================`);
    console.log(`🚀 IMPOSTOR TECHNO - Real-Time Game Server`);
    console.log(`📡 Server running on http://127.0.0.1:${port}`);
    console.log(`🌐 Ready for Apache Reverse Proxy / XAMPP on Port 80`);
    console.log(`================================================================`);
  }

  function onError(err) {
    server.removeListener('listening', onListen);
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ [PORT OCCUPIED] Port ${port} sedang digunakan. Mencoba port ${port + 1}...`);
      setTimeout(() => tryListen(port + 1), 200);
    } else {
      console.error('Fatal Server Error:', err);
    }
  }

  server.once('error', onError);
  server.once('listening', onListen);
  server.listen(port, '0.0.0.0');
}

tryListen(currentPort);
