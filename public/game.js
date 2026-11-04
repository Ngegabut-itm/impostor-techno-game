/**
 * ==============================================================================
 * IMPOSTOR TECHNO - CLIENT ENGINE & GAME LOOP
 * ==============================================================================
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // 1. GLOBAL STATE & CONSTANTS
  // ----------------------------------------------------------------------------
  const socket = io({ transports: ['websocket', 'polling'] });

  const MAP_WIDTH = 1400;
  const MAP_HEIGHT = 1050;
  const PLAYER_SPEED = 240; // px/sec

  // Palette definitions
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

  // Map Rooms Definition
  const ROOMS_INFO = [
    { id: 'war-room', name: '🚨 INCIDENT WAR ROOM', x: 700, y: 220, w: 420, h: 260 },
    { id: 'dev-cubicles', name: '💻 DEV OPEN SPACE', x: 260, y: 440, w: 380, h: 420 },
    { id: 'server-room', name: '⚡ SERVER RACK ROOM', x: 1140, y: 440, w: 380, h: 420 },
    { id: 'pantry', name: '☕ TECH PANTRY & LOUNGE', x: 700, y: 840, w: 440, h: 280 }
  ];

  // Task stations
  const TASK_DEFINITIONS = [
    { id: 'task-patch-cord', title: 'Fix Switch & Patch Cord', room: 'Server Room', modalId: 'modal-task-patch-cord', x: 1250, y: 560, radius: 65 },
    { id: 'task-deploy-hotfix', title: 'Deploy Hotfix ke Production', room: 'Dev Open Space', modalId: 'modal-task-deploy-hotfix', x: 180, y: 350, radius: 65 },
    { id: 'task-restock-coffee', title: 'Restock Biji Kopi Pantry', room: 'Tech Pantry', modalId: 'modal-task-restock-coffee', x: 550, y: 770, radius: 65 },
    { id: 'task-restart-router', title: 'Restart Core Router', room: 'Server Room', modalId: 'modal-task-restart-router', x: 1250, y: 330, radius: 65 }
  ];

  // Sabotage console
  const SABOTAGE_TERMINAL = { id: 'terminal-kernel-panic', name: 'Main Server Console', modalId: 'modal-sabotage-terminal', x: 1060, y: 330, radius: 70 };

  // Emergency Button (Conference Table Alarm)
  const EMERGENCY_BUTTON = { id: 'emergency-button', x: 700, y: 220, radius: 150 };

  // Vents
  const VENTS = [
    { id: 'vent-server', name: 'Rack Vent Alpha', x: 1240, y: 590, connectedTo: ['vent-dev', 'vent-pantry'] },
    { id: 'vent-dev', name: 'Cable Duct Beta', x: 170, y: 600, connectedTo: ['vent-server', 'vent-pantry'] },
    { id: 'vent-pantry', name: 'Air Shaft Gamma', x: 860, y: 920, connectedTo: ['vent-server', 'vent-dev'] }
  ];

  // In-room solid obstacles (conference table, dev desks, server racks, pantry, printer)
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

  // Client State
  let myId = null;
  let myRole = 'dev'; // 'dev' | 'impostor'
  let isAlive = true;
  let isHost = false;
  let currentRoomCode = '';
  let selectedColor = PLAYER_COLORS[0];
  let myTasks = [];
  let myTasksCompleted = [];
  let currentGameState = 'LOBBY';

  // Remote entities
  let remotePlayers = {};
  let deadBodies = [];
  let activeSabotage = { active: false };
  let currentMeeting = null;

  // Local movement
  let localPos = { x: 700, y: 310, vx: 0, vy: 0, facing: 'right' };
  let targetPos = null;
  let killCooldown = 15;
  let inVent = null;
  let nearestInteractable = null;
  let nearestBody = null;
  let nearestKillTarget = null;
  let nearestVent = null;

  // Input states
  const keys = {};
  let joystickVector = { x: 0, y: 0 };
  let joystickActive = false;

  // Camera
  let camera = { x: 0, y: 0 };

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const screenLobby = document.getElementById('screen-lobby');
  const screenGame = document.getElementById('screen-game');
  const waitingRoomOverlay = document.getElementById('waiting-room-overlay');

  // HUD Elements
  const hudProgressFill = document.getElementById('hud-progress-fill');
  const hudProgressPct = document.getElementById('hud-progress-percentage');
  const hudCurrentRoom = document.getElementById('hud-current-room');
  const hudRoleCard = document.getElementById('hud-role-card');
  const hudRoleTitle = document.getElementById('hud-role-title');
  const hudRoleSub = document.getElementById('hud-role-subtitle');
  const sabotageBanner = document.getElementById('sabotage-alarm-banner');
  const sabotageTimerDisplay = document.getElementById('sabotage-timer-display');
  const taskListElement = document.getElementById('task-list');

  // Action Buttons
  const btnActionUse = document.getElementById('btn-action-use');
  const btnActionReport = document.getElementById('btn-action-report');
  const btnActionKill = document.getElementById('btn-action-kill');
  const btnActionVent = document.getElementById('btn-action-vent');
  const btnActionSabotage = document.getElementById('btn-action-sabotage');
  const killCooldownOverlay = document.getElementById('kill-cooldown-overlay');
  const killCooldownNum = document.getElementById('kill-cooldown-num');

  // Modals
  const modalMeeting = document.getElementById('modal-emergency-meeting');
  const modalGameOver = document.getElementById('modal-game-over');

  // ----------------------------------------------------------------------------
  // 2. WEB AUDIO SYNTHESIZER (ZERO ASSET DEPENDENCY)
  // ----------------------------------------------------------------------------
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'task_done') {
        // Melodic celebratory arpeggio: C5, E5, G5, C6
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.2, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.25);
        });
      } else if (type === 'emergency') {
        // Oscillating alarm siren
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(750, now + i * 0.2);
          osc.frequency.linearRampToValueAtTime(1100, now + i * 0.2 + 0.1);
          osc.frequency.linearRampToValueAtTime(750, now + i * 0.2 + 0.2);
          gain.gain.setValueAtTime(0.25, now + i * 0.2);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.2 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.2);
        }
      } else if (type === 'kill') {
        // Glitch bass crash
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  // Toast Notification
  function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ----------------------------------------------------------------------------
  // 3. LOBBY UI & PROFILE INITIALIZATION
  // ----------------------------------------------------------------------------
  function initLobbyUI() {
    const paletteContainer = document.getElementById('color-palette');
    const avatarCanvas = document.getElementById('avatar-preview-canvas');
    const avatarCtx = avatarCanvas.getContext('2d');
    const colorNameEl = document.getElementById('avatar-color-name');
    const nameInput = document.getElementById('player-name-input');

    // Default random name
    const sampleNames = ['Andi Backend', 'Budi Lead', 'Siti DevOps', 'Raka SRE', 'Maya QA', 'Dimas Intern'];
    nameInput.value = sampleNames[Math.floor(Math.random() * sampleNames.length)];

    // Render Color Swatches
    PLAYER_COLORS.forEach((col, idx) => {
      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${idx === 0 ? 'active' : ''}`;
      swatch.style.backgroundColor = col.hex;
      swatch.style.color = col.hex;
      swatch.title = col.name;

      swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        selectedColor = col;
        colorNameEl.textContent = col.name;
        colorNameEl.style.color = col.hex;
        drawAvatarPreview(avatarCtx, col);
        playSound('click');
      });

      paletteContainer.appendChild(swatch);
    });

    function drawAvatarPreview(c, col) {
      c.clearRect(0, 0, 80, 95);
      renderCartoonOfficeCharacter(c, 40, 52, col, 'Dev', false, 'right', false, false);
    }
    drawAvatarPreview(avatarCtx, selectedColor);

    // Tab buttons switching
    const tabBtnCreate = document.getElementById('tab-btn-create');
    const tabBtnJoin = document.getElementById('tab-btn-join');
    const tabContentCreate = document.getElementById('tab-content-create');
    const tabContentJoin = document.getElementById('tab-content-join');

    tabBtnCreate.addEventListener('click', () => {
      tabBtnCreate.classList.add('active');
      tabBtnJoin.classList.remove('active');
      tabContentCreate.classList.add('active');
      tabContentJoin.classList.remove('active');
      playSound('click');
    });

    tabBtnJoin.addEventListener('click', () => {
      tabBtnJoin.classList.add('active');
      tabBtnCreate.classList.remove('active');
      tabContentJoin.classList.add('active');
      tabContentCreate.classList.remove('active');
      playSound('click');
    });

    // Create Room Button
    document.getElementById('btn-create-room').addEventListener('click', () => {
      const name = nameInput.value.trim() || 'Engineer';
      socket.emit('create_room', { playerName: name, color: selectedColor });
      playSound('click');
    });

    // Join Room Button
    document.getElementById('btn-join-room').addEventListener('click', () => {
      const name = nameInput.value.trim() || 'Engineer';
      const code = document.getElementById('room-code-input').value.trim();
      if (!code) {
        showToast('Masukkan kode room terlebih dahulu!');
        return;
      }
      socket.emit('join_room', { roomCode: code, playerName: name, color: selectedColor });
      playSound('click');
    });

    // Copy Room Code Button
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(currentRoomCode);
      showToast(`Kode ${currentRoomCode} disalin ke clipboard!`);
      playSound('click');
    });

    // Add Bot Button
    document.getElementById('btn-add-bot').addEventListener('click', () => {
      socket.emit('add_bot');
      playSound('click');
    });

    // Start Game Button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      socket.emit('start_game');
      playSound('click');
    });

    // Play Again Button (on Game Over)
    document.getElementById('btn-play-again').addEventListener('click', () => {
      socket.emit('play_again');
      playSound('click');
    });

    // Close Modal X Buttons
    document.querySelectorAll('.btn-close-modal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        if (modalId) {
          const el = document.getElementById(modalId);
          if (el) el.classList.add('hidden');
          playSound('click');
        }
      });
    });

    // Close Modal on backdrop click (except meeting and game over)
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (overlay.id === 'modal-emergency-meeting' || overlay.id === 'modal-game-over') return;
        if (e.target === overlay) {
          overlay.classList.add('hidden');
          playSound('click');
        }
      });
    });

    // Toggle Task Checklist
    const btnToggle = document.getElementById('btn-toggle-checklist') || document.getElementById('btn-toggle-tasks');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const card = document.getElementById('slacker-tasks-card') || document.getElementById('task-checklist-panel');
        if (card) {
          card.classList.toggle('collapsed');
          playSound('click');
        }
      });
    }
  }

  // ----------------------------------------------------------------------------
  // 4. SOCKET.IO EVENT LISTENERS
  // ----------------------------------------------------------------------------
  socket.on('connect', () => {
    myId = socket.id;
  });

  socket.on('error_message', (msg) => {
    showToast(msg);
  });

  socket.on('room_created', ({ roomCode, playerId, isHost: hostFlag, players }) => {
    currentRoomCode = roomCode;
    isHost = hostFlag;
    myId = playerId;
    document.getElementById('display-room-code').textContent = roomCode;
    waitingRoomOverlay.classList.remove('hidden');
    updateWaitingRoster(players);
    showToast(`War Room ${roomCode} berhasil dibuat!`);
  });

  socket.on('room_joined', ({ roomCode, playerId, isHost: hostFlag, players }) => {
    currentRoomCode = roomCode;
    isHost = hostFlag;
    myId = playerId;
    document.getElementById('display-room-code').textContent = roomCode;
    waitingRoomOverlay.classList.remove('hidden');
    updateWaitingRoster(players);
    showToast(`Berhasil masuk ke War Room ${roomCode}`);
  });

  socket.on('lobby_updated', ({ players, hostId }) => {
    isHost = hostId === myId;
    updateWaitingRoster(players);
  });

  function updateWaitingRoster(players) {
    const rosterGrid = document.getElementById('roster-grid');
    rosterGrid.innerHTML = '';
    const count = Object.keys(players).length;
    document.getElementById('connected-count').textContent = count;

    for (const id in players) {
      const p = players[id];
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.innerHTML = `
        <div class="roster-avatar-dot" style="background-color: ${p.color.hex}; color: ${p.color.hex}"></div>
        <span class="roster-name">${p.name}</span>
        ${p.id === socket.id ? '<span class="text-cyan font-mono">(Anda)</span>' : ''}
      `;
      rosterGrid.appendChild(card);
    }

    // Hide or show Host controls
    const btnStart = document.getElementById('btn-start-game');
    const btnAddBot = document.getElementById('btn-add-bot');
    if (isHost) {
      btnStart.classList.remove('hidden');
      btnAddBot.classList.remove('hidden');
    } else {
      btnStart.classList.add('hidden');
      btnAddBot.classList.add('hidden');
    }
  }

  // Game Started
  socket.on('game_started', ({ role, tasks, taskDefinitions, impostorTeam, spawnPos }) => {
    myRole = role;
    isAlive = true;
    myTasks = tasks;
    myTasksCompleted = [];
    currentGameState = 'PLAYING';
    targetPos = null;

    // Spawn player safely outside the conference table
    if (spawnPos) {
      localPos.x = spawnPos.x;
      localPos.y = spawnPos.y;
    } else {
      localPos.x = 700;
      localPos.y = 310;
    }
    localPos.vx = 0;
    localPos.vy = 0;

    // Center camera on player immediately
    camera.x = localPos.x - canvas.width / 2;
    camera.y = localPos.y - canvas.height / 2;

    // Hide lobby & waiting room
    waitingRoomOverlay.classList.add('hidden');
    screenLobby.classList.remove('active');
    screenGame.classList.add('active');

    // Blur any lobby text input to enable WASD movement immediately
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    window.focus();
    resizeCanvas();

    // --------------------------------------------------------------------------
    // UPDATE HUD ROOM & ROLE
    // --------------------------------------------------------------------------
    const roomCodeEl = document.getElementById('hud-room-code');
    if (roomCodeEl && currentRoomCode) {
      roomCodeEl.textContent = currentRoomCode;
    }

    // Update Role HUD
    const hudRoleCard = document.getElementById('hud-role-card');
    const hudRoleTitle = document.getElementById('hud-role-title');
    const hudRoleIcon = document.getElementById('hud-role-icon');

    // Keep all 4 buttons visible in the 2x2 grid layout matching reference screenshot
    btnActionUse.classList.remove('hidden');
    btnActionVent.classList.remove('hidden');
    btnActionReport.classList.remove('hidden');
    btnActionKill.classList.remove('hidden');

    if (myRole === 'impostor') {
      killCooldown = 15;
      if (hudRoleCard) hudRoleCard.className = 'slacker-role-indicator role-impostor';
      if (hudRoleTitle) hudRoleTitle.textContent = 'IMPOSTOR';
      if (hudRoleIcon) hudRoleIcon.textContent = '👺';
      btnActionSabotage.classList.remove('hidden');
      showToast('⚠️ ANDA ADALAH IMPOSTOR! Sabotase dan eliminasi Dev tanpa saksi!');
    } else {
      if (hudRoleCard) hudRoleCard.className = 'slacker-role-indicator role-dev';
      if (hudRoleTitle) hudRoleTitle.textContent = 'DEV';
      if (hudRoleIcon) hudRoleIcon.textContent = '👨‍💻';
      btnActionSabotage.classList.add('hidden');
      showToast('⚡ ANDA ADALAH ENGINEER! Selesaikan tugas sprint secepatnya!');
    }

    updateTaskChecklistUI();
    playSound('task_done');
  });

  socket.on('game_state_changed', ({ state, players }) => {
    currentGameState = state;
    remotePlayers = players;
  });

  // Authoritative Game Tick Snapshot
  socket.on('game_tick', (snap) => {
    currentGameState = snap.state;
    remotePlayers = snap.players;
    deadBodies = snap.bodies;
    activeSabotage = snap.sabotage;

    // Update Total Sprint Progress Bar
    const progressFill = document.getElementById('hud-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${snap.totalTasksProgress}%`;
    }

    // Sabotage Alarm Banner
    if (snap.sabotage && snap.sabotage.active) {
      sabotageBanner.classList.remove('hidden');
      sabotageTimerDisplay.textContent = `${snap.sabotage.remainingSeconds}s`;
    } else {
      sabotageBanner.classList.add('hidden');
    }

    // Update local player status if updated on server
    if (myId && remotePlayers[myId]) {
      const serverMe = remotePlayers[myId];
      isAlive = serverMe.isAlive;
    }

    // Meeting countdown tick
    if (snap.meeting && currentMeeting) {
      document.getElementById('meeting-countdown-display').textContent = `${snap.meeting.remainingSeconds}s`;
      document.getElementById('vote-count-status').textContent = `${snap.meeting.votedList.length} Suara Masuk`;
    }
  });

  // Task Acknowledged
  socket.on('task_acknowledged', ({ taskId, tasksCompleted }) => {
    myTasksCompleted = tasksCompleted;
    updateTaskChecklistUI();
    playSound('task_done');
    showToast('✅ Task berhasil diselesaikan!');
  });

  // Render Tasks Checklist matching the screenshot:
  // - Fix the Printer [|||||||||||| 60%]
  // - Brew Coffee [|||||||| 40%]
  // - Submit Report [ ]
  function updateTaskChecklistUI() {
    taskListElement.innerHTML = '';

    const friendlyTitles = {
      'task-patch-cord': 'Fix the Printer / Switch',
      'task-deploy-hotfix': 'Submit Report & Deploy',
      'task-restock-coffee': 'Brew Coffee in Pantry',
      'task-restart-router': 'Restart Core Gateway'
    };

    TASK_DEFINITIONS.forEach((t) => {
      const isDone = myTasksCompleted.includes(t.id);
      const title = friendlyTitles[t.id] || t.title;

      let progressGraph = '[ ]';
      if (isDone) {
        progressGraph = '[|||||||||||| 100%]';
      }

      const li = document.createElement('li');
      li.className = `slacker-task-row ${isDone ? 'completed' : ''}`;
      li.innerHTML = `
        <span>- ${title}</span>
        <span class="slacker-task-bar">${progressGraph}</span>
      `;
      taskListElement.appendChild(li);
    });
  }

  // Player Eliminated
  socket.on('player_eliminated', ({ killerName }) => {
    isAlive = false;
    playSound('kill');
    showToast('💀 AKSES ANDA DILUMPUSHKAN! Anda sekarang menjadi Ghost.');
  });

  // Body Dropped
  socket.on('body_dropped', ({ body }) => {
    playSound('kill');
  });

  // Sabotage Started
  socket.on('sabotage_started', () => {
    playSound('emergency');
    showToast('⚠️ ALARM: KERNEL PANIC AKTIF! Segera reboot Server Room!');
  });

  socket.on('sabotage_resolved', ({ repairedBy }) => {
    showToast(`✅ Server berhasil direboot oleh ${repairedBy}!`);
    document.getElementById('modal-sabotage-terminal').classList.add('hidden');
  });

  // Emergency Meeting Started
  socket.on('meeting_started', ({ caller, reason, bodyVictim, timer, alivePlayers }) => {
    playSound('emergency');
    currentMeeting = { caller, reason, bodyVictim, timer };

    // Close any open task mini-game
    document.querySelectorAll('.mini-game-box').forEach((box) => {
      box.closest('.modal-overlay').classList.add('hidden');
    });

    const headline = document.getElementById('meeting-headline');
    const subheadline = document.getElementById('meeting-subheadline');

    if (reason === 'BODY') {
      headline.textContent = '💀 DEAD BODY / BSOD REPORTED!';
      subheadline.textContent = `${caller} menemukan laptop BSOD milik rekan kerja!`;
    } else {
      headline.textContent = '🚨 EMERGENCY MEETING DIPANGGIL!';
      subheadline.textContent = `${caller} menekan tombol darurat di War Room!`;
    }

    // Render Coworker voting roster
    const votingGrid = document.getElementById('voting-roster-grid');
    votingGrid.innerHTML = '';

    alivePlayers.forEach((p) => {
      const card = document.createElement('div');
      card.className = `vote-card ${p.id === myId ? 'my-card' : ''}`;
      card.id = `vote-card-${p.id}`;
      card.innerHTML = `
        <div class="vote-avatar-dot" style="background-color: ${p.color.hex}"></div>
        <span class="vote-name">${p.name} ${p.id === myId ? '(Anda)' : ''}</span>
      `;

      // Allow voting if self is alive
      if (isAlive && p.id !== myId) {
        card.addEventListener('click', () => {
          document.querySelectorAll('.vote-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          socket.emit('cast_vote', { targetId: p.id });
          playSound('click');
          showToast(`Anda memilih ${p.name}`);
        });
      }

      votingGrid.appendChild(card);
    });

    modalMeeting.classList.remove('hidden');
    document.getElementById('meeting-results-banner').classList.add('hidden');
  });

  // Skip Vote
  document.getElementById('btn-skip-vote').addEventListener('click', () => {
    if (isAlive) {
      socket.emit('cast_vote', { targetId: 'SKIP' });
      document.querySelectorAll('.vote-card').forEach((c) => c.classList.remove('selected'));
      playSound('click');
      showToast('Anda memilih untuk SKIP vote.');
    }
  });

  // Vote Cast update
  socket.on('vote_cast', ({ voterId, totalVotes }) => {
    // Indicator that someone voted
  });

  // Meeting Chat Send
  const formChat = document.getElementById('form-war-room-chat');
  const inputChat = document.getElementById('input-meeting-chat');
  formChat.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputChat.value.trim();
    if (text) {
      socket.emit('send_meeting_chat', { text });
      inputChat.value = '';
    }
  });

  // Quick Chat reaction chips
  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      const msg = chip.getAttribute('data-msg');
      if (msg) {
        socket.emit('send_meeting_chat', { text: msg });
        playSound('click');
      }
    });
  });

  socket.on('meeting_chat_received', (msg) => {
    const feed = document.getElementById('war-room-chat-feed');
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `
      <div class="chat-sender" style="color: ${msg.senderColor.hex}">
        ${msg.senderName} ${msg.isDead ? '💀 (Ghost)' : ''}
        <span class="text-dim font-mono" style="font-size: 0.65rem; margin-left: 6px;">${msg.timestamp}</span>
      </div>
      <div>${msg.text}</div>
    `;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  });

  // Meeting Concluded
  socket.on('meeting_concluded', ({ ejectionResult, tally, remainingImpostors }) => {
    const resultsBanner = document.getElementById('meeting-results-banner');
    const verdictTitle = document.getElementById('ejection-verdict-title');
    const verdictDesc = document.getElementById('ejection-verdict-desc');

    resultsBanner.classList.remove('hidden');

    if (ejectionResult.isTie) {
      verdictTitle.textContent = 'HASIL VOTE SERI (TIE)';
      verdictDesc.textContent = `Tidak ada akun yang di-revoke. (${remainingImpostors} Impostor tersisa)`;
    } else if (ejectionResult.isSkipped || !ejectionResult.ejected) {
      verdictTitle.textContent = 'VOTE DILEWATI (SKIPPED)';
      verdictDesc.textContent = `Mayoritas memilih skip. (${remainingImpostors} Impostor tersisa)`;
    } else {
      const ej = ejectionResult.ejected;
      verdictTitle.textContent = `${ej.name} TELAH DI-REVOKE!`;
      if (ejectionResult.wasImpostor) {
        verdictDesc.textContent = `DIA ADALAH IMPOSTOR! (${remainingImpostors} Impostor tersisa)`;
        verdictDesc.className = 'ejection-desc font-mono text-emerald';
      } else {
        verdictDesc.textContent = `Dia BUKAN Impostor. (${remainingImpostors} Impostor tersisa)`;
        verdictDesc.className = 'ejection-desc font-mono text-rose';
      }
    }
  });

  // Resume game after meeting
  socket.on('resume_game', ({ players }) => {
    modalMeeting.classList.add('hidden');
    remotePlayers = players;
    if (myId && players[myId]) {
      localPos.x = players[myId].x;
      localPos.y = players[myId].y;
    }
  });

  // Game Over
  socket.on('game_over', ({ winner, reason, players }) => {
    modalMeeting.classList.add('hidden');
    modalGameOver.classList.remove('hidden');

    const title = document.getElementById('game-over-title');
    const desc = document.getElementById('game-over-reason');
    const icon = document.getElementById('game-over-icon');

    if (winner === 'CREWMATES') {
      title.textContent = 'VICTORY';
      title.className = 'game-over-title text-emerald';
      icon.textContent = '🏆';
      if (reason === 'TASKS_DONE') {
        desc.textContent = 'Seluruh tugas sprint kantor berhasil diselesaikan tepat waktu!';
      } else {
        desc.textContent = 'Seluruh Impostor berhasil diidentifikasi dan di-kick!';
      }
    } else {
      title.textContent = 'DEFEAT';
      title.className = 'game-over-title text-rose';
      icon.textContent = '💀';
      if (reason === 'SABOTAGE_TIMEOUT') {
        desc.textContent = 'Kernel Panic merobohkan seluruh cluster server kantor!';
      } else {
        desc.textContent = 'Impostor berhasil melumpuhkan tim engineering kantor!';
      }
    }

    // Role reveal list
    const roster = document.getElementById('game-over-roster');
    roster.innerHTML = '';
    for (const id in players) {
      const p = players[id];
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.innerHTML = `
        <div class="roster-avatar-dot" style="background-color: ${p.color.hex}"></div>
        <div>
          <span class="roster-name">${p.name}</span>
          <div class="font-mono text-dim" style="font-size: 0.7rem;">
            ${p.role === 'impostor' ? '<span class="text-rose font-bold">IMPOSTOR</span>' : '<span class="text-cyan">ENGINEER</span>'}
          </div>
        </div>
      `;
      roster.appendChild(card);
    }
  });

  // Lobby Reset
  socket.on('lobby_reset', ({ players, hostId }) => {
    modalGameOver.classList.add('hidden');
    screenGame.classList.remove('active');
    screenLobby.classList.add('active');
    waitingRoomOverlay.classList.remove('hidden');
    updateWaitingRoster(players);
  });

  // ----------------------------------------------------------------------------
  // 5. INPUT HANDLING (KEYBOARD & MOBILE VIRTUAL JOYSTICK)
  // ----------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // If typing in visible text input (e.g. Incident War Room chat during meeting), don't trigger game keys
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (document.activeElement.offsetParent !== null) {
        return;
      } else {
        document.activeElement.blur();
      }
    }

    const keyLower = e.key ? e.key.toLowerCase() : '';
    keys[keyLower] = true;
    if (e.code) keys[e.code] = true;

    // Hotkeys
    if (e.code === 'Space') {
      e.preventDefault();
      triggerUseAction();
    } else if (keyLower === 'r') {
      triggerReportAction();
    } else if (keyLower === 'q') {
      triggerKillAction();
    } else if (keyLower === 'e' || keyLower === 'v') {
      triggerVentAction();
    }
  });

  window.addEventListener('keyup', (e) => {
    const keyLower = e.key ? e.key.toLowerCase() : '';
    keys[keyLower] = false;
    if (e.code) keys[e.code] = false;
  });

  // Virtual Joystick Touch Logic
  const joystickZone = document.getElementById('joystick-zone');
  const joystickBase = document.getElementById('joystick-base');
  const joystickThumb = document.getElementById('joystick-thumb');
  let joystickTouchId = null;
  let joystickCenter = { x: 0, y: 0 };
  const JOYSTICK_MAX_RADIUS = 45;

  joystickZone.addEventListener('pointerdown', (e) => {
    joystickActive = true;
    joystickTouchId = e.pointerId;
    const rect = joystickBase.getBoundingClientRect();
    joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    handleJoystickMove(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', (e) => {
    if (!joystickActive || e.pointerId !== joystickTouchId) return;
    handleJoystickMove(e.clientX, e.clientY);
  });

  const endJoystick = (e) => {
    if (joystickActive && e.pointerId === joystickTouchId) {
      joystickActive = false;
      joystickVector = { x: 0, y: 0 };
      joystickThumb.style.transform = `translate(0px, 0px)`;
    }
  };
  window.addEventListener('pointerup', endJoystick);
  window.addEventListener('pointercancel', endJoystick);

  function handleJoystickMove(clientX, clientY) {
    const dx = clientX - joystickCenter.x;
    const dy = clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      joystickVector = { x: 0, y: 0 };
      joystickThumb.style.transform = `translate(0px, 0px)`;
      return;
    }

    const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
    joystickVector = {
      x: thumbX / JOYSTICK_MAX_RADIUS,
      y: thumbY / JOYSTICK_MAX_RADIUS
    };
  }

  // Direct Canvas Click/Tap Interaction & Click-to-Move
  canvas.addEventListener('pointerdown', (e) => {
    // Only in playing mode
    if (currentGameState !== 'PLAYING') return;

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left + camera.x;
    const clickY = e.clientY - rect.top + camera.y;

    // 1. Check if clicked near Emergency Table/Button
    const distToEmerg = Math.hypot(clickX - EMERGENCY_BUTTON.x, clickY - EMERGENCY_BUTTON.y);
    if (distToEmerg < 140) {
      if (Math.hypot(localPos.x - EMERGENCY_BUTTON.x, localPos.y - EMERGENCY_BUTTON.y) <= EMERGENCY_BUTTON.radius && isAlive) {
        socket.emit('call_meeting', { reason: 'BUTTON' });
        playSound('emergency');
        showToast('🚨 EMERGENCY MEETING DIPANGGIL!');
      } else {
        // Move towards meeting table
        targetPos = { x: EMERGENCY_BUTTON.x, y: EMERGENCY_BUTTON.y + 80 };
        showToast('Berjalan menuju meja Incident War Room...');
      }
      return;
    }

    // 2. Check if clicked near a Task Station
    for (const t of TASK_DEFINITIONS) {
      const distClick = Math.hypot(clickX - t.x, clickY - t.y);
      if (distClick < 90) {
        if (Math.hypot(localPos.x - t.x, localPos.y - t.y) <= t.radius) {
          openTaskMiniGame(t);
          playSound('click');
        } else {
          // Move towards task
          targetPos = { x: t.x, y: t.y };
          showToast(`Berjalan menuju ${t.title}...`);
        }
        return;
      }
    }

    // 3. Check if clicked near Dead Body (BSOD Laptop)
    for (const b of deadBodies) {
      if (Math.hypot(clickX - b.x, clickY - b.y) < 80) {
        if (Math.hypot(localPos.x - b.x, localPos.y - b.y) < 110 && isAlive) {
          triggerReportAction();
        } else {
          targetPos = { x: b.x, y: b.y };
          showToast('Mendekati laptop BSOD untuk report...');
        }
        return;
      }
    }

    // 4. Impostor: Click on Coworker to Slack / Revoke
    if (myRole === 'impostor' && isAlive) {
      for (const id in remotePlayers) {
        if (id === myId) continue;
        const p = remotePlayers[id];
        if (p.isAlive && !p.isGhost && Math.hypot(clickX - p.x, clickY - p.y) < 65) {
          if (Math.hypot(localPos.x - p.x, localPos.y - p.y) < 100 && killCooldown <= 0) {
            socket.emit('kill_target', { targetId: p.id });
            killCooldown = 25;
            playSound('kill');
          } else {
            targetPos = { x: p.x, y: p.y };
          }
          return;
        }
      }
    }

    // 5. Click-to-move to clicked point on the floor
    targetPos = { x: clickX, y: clickY };
  });

  // Floating Action Buttons Listeners
  btnActionUse.addEventListener('click', triggerUseAction);
  btnActionReport.addEventListener('click', triggerReportAction);
  btnActionKill.addEventListener('click', triggerKillAction);
  btnActionVent.addEventListener('click', triggerVentAction);
  btnActionSabotage.addEventListener('click', () => {
    if (myRole === 'impostor' && isAlive) {
      if (activeSabotage && activeSabotage.active) {
        showToast('Sabotase Kernel Panic sedang berlangsung!');
        return;
      }
      socket.emit('trigger_sabotage', { type: 'KERNEL_PANIC' });
      playSound('emergency');
      showToast('🚨 KERNEL PANIC DISULUT! Ruang server padam!');
    } else {
      showToast('Hanya Impostor yang bisa menyabotase sistem!');
    }
  });

  // Action Triggers
  function triggerUseAction() {
    // 1. Emergency Button
    const distButton = Math.hypot(localPos.x - EMERGENCY_BUTTON.x, localPos.y - EMERGENCY_BUTTON.y);
    if (distButton <= EMERGENCY_BUTTON.radius && isAlive) {
      socket.emit('call_meeting', { reason: 'BUTTON' });
      playSound('emergency');
      return;
    }

    // 2. Sabotage Terminal (Server room)
    if (activeSabotage && activeSabotage.active) {
      const distSab = Math.hypot(localPos.x - SABOTAGE_TERMINAL.x, localPos.y - SABOTAGE_TERMINAL.y);
      if (distSab <= SABOTAGE_TERMINAL.radius) {
        document.getElementById(SABOTAGE_TERMINAL.modalId).classList.remove('hidden');
        playSound('click');
        return;
      }
    }

    // 3. Task Stations
    for (const t of TASK_DEFINITIONS) {
      const dist = Math.hypot(localPos.x - t.x, localPos.y - t.y);
      if (dist <= t.radius) {
        openTaskMiniGame(t);
        playSound('click');
        return;
      }
    }

    showToast('Tidak ada task atau tombol darurat di dekatmu!');
  }

  function triggerReportAction() {
    if (!isAlive) return;
    if (!nearestBody) {
      showToast('Tidak ada rekan kerja yang terkena BSOD di dekatmu!');
      return;
    }
    socket.emit('call_meeting', { reason: 'BODY', bodyId: nearestBody.id });
    playSound('emergency');
  }

  function triggerKillAction() {
    if (myRole !== 'impostor') {
      showToast('Hanya Impostor yang bisa melakukan Silent Terminate / Slack!');
      return;
    }
    if (!isAlive) return;
    if (killCooldown > 0) {
      showToast(`Cooldown Slack tersisa ${Math.ceil(killCooldown)}s!`);
      return;
    }
    if (!nearestKillTarget) {
      showToast('Mendekatlah ke rekan kerja yang ingin di-slack!');
      return;
    }
    socket.emit('kill_target', { targetId: nearestKillTarget.id });
    killCooldown = 25;
    playSound('kill');
  }

  function triggerVentAction() {
    if (myRole !== 'impostor') {
      showToast('Hanya Impostor yang bisa menyusup ke vent kabel!');
      return;
    }
    if (!isAlive) return;

    if (inVent) {
      // Exit vent
      socket.emit('vent_action', { action: 'EXIT' });
      inVent = null;
      showToast('Keluar dari vent!');
      playSound('click');
    } else if (nearestVent) {
      // Enter vent
      socket.emit('vent_action', { action: 'ENTER', ventId: nearestVent.id });
      inVent = nearestVent.id;
      showToast(`Menyusup ke dalam ${nearestVent.name}!`);
      playSound('click');
    } else {
      showToast('Mendekatlah ke lubang server rack vent!');
    }
  }

  socket.on('vent_status', ({ inVent: ventId, availableVents }) => {
    inVent = ventId;
  });

  // ----------------------------------------------------------------------------
  // 6. MINI-GAME TASK IMPLEMENTATIONS
  // ----------------------------------------------------------------------------
  function openTaskMiniGame(taskDef) {
    const modal = document.getElementById(taskDef.modalId);
    if (!modal) return;
    modal.classList.remove('hidden');

    if (taskDef.id === 'task-patch-cord') {
      initCablePuzzle();
    } else if (taskDef.id === 'task-deploy-hotfix') {
      initHotfixDeploy();
    } else if (taskDef.id === 'task-restock-coffee') {
      initCoffeeRestock();
    } else if (taskDef.id === 'task-restart-router') {
      initRouterRestart();
    }
  }

  // --- TASK 1: FIX SWITCH & PATCH CORD ---
  function initCablePuzzle() {
    const container = document.getElementById('cable-puzzle-container');
    const svgLayer = document.getElementById('cable-svg-canvas');
    const sourcesCol = document.getElementById('cable-sources');
    const targetsCol = document.getElementById('cable-targets');
    const statusText = document.getElementById('cable-status-text');

    sourcesCol.innerHTML = '';
    targetsCol.innerHTML = '';
    svgLayer.innerHTML = '';

    const colors = [
      { name: 'Cyan 10GbE', hex: '#06b6d4', id: 'c1' },
      { name: 'Magenta VLAN', hex: '#ec4899', id: 'c2' },
      { name: 'Amber iSCSI', hex: '#f59e0b', id: 'c3' },
      { name: 'Emerald Core', hex: '#10b981', id: 'c4' }
    ];

    // Shuffled targets
    const shuffledTargets = [...colors].sort(() => Math.random() - 0.5);
    const connected = {};

    colors.forEach((c) => {
      const pin = document.createElement('div');
      pin.className = 'cable-pin';
      pin.dataset.colorId = c.id;
      pin.innerHTML = `
        <div class="cable-node" style="background-color: ${c.hex}; color: ${c.hex}"></div>
        <span class="cable-label">${c.name}</span>
      `;
      sourcesCol.appendChild(pin);
    });

    shuffledTargets.forEach((c) => {
      const port = document.createElement('div');
      port.className = 'rj45-port';
      port.dataset.colorId = c.id;
      port.innerHTML = `
        <span class="cable-label">${c.name}</span>
        <div class="port-socket" style="color: ${c.hex}">RJ45</div>
      `;
      targetsCol.appendChild(port);
    });

    let activeDrag = null;
    let tempPath = null;
    let selectedPin = null;

    // Click-to-connect support
    sourcesCol.onclick = (e) => {
      const pin = e.target.closest('.cable-pin');
      if (!pin) return;
      const colorId = pin.dataset.colorId;
      if (connected[colorId]) return;

      sourcesCol.querySelectorAll('.cable-pin').forEach((p) => p.style.transform = 'scale(1)');
      pin.style.transform = 'scale(1.15)';
      selectedPin = pin;
      playSound('click');
      statusText.textContent = `Kabel terpilih. Klik port switch yang warnanya sama!`;
    };

    targetsCol.onclick = (e) => {
      const port = e.target.closest('.rj45-port');
      if (!port || !selectedPin) return;

      const colorId = selectedPin.dataset.colorId;
      if (port.dataset.colorId === colorId && !connected[colorId]) {
        // Connect!
        connected[colorId] = true;
        const sock = port.querySelector('.port-socket');
        sock.classList.add('connected');
        selectedPin.style.transform = 'scale(1)';

        const rect = container.getBoundingClientRect();
        const pinRect = selectedPin.querySelector('.cable-node').getBoundingClientRect();
        const sockRect = sock.getBoundingClientRect();

        const startX = pinRect.left + pinRect.width / 2 - rect.left;
        const startY = pinRect.top + pinRect.height / 2 - rect.top;
        const targetX = sockRect.left + sockRect.width / 2 - rect.left;
        const targetY = sockRect.top + sockRect.height / 2 - rect.top;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', colors.find((c) => c.id === colorId).hex);
        path.setAttribute('stroke-width', '8');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        const d = `M ${startX} ${startY} C ${startX + 80} ${startY}, ${targetX - 80} ${targetY}, ${targetX} ${targetY}`;
        path.setAttribute('d', d);
        svgLayer.appendChild(path);

        playSound('click');
        selectedPin = null;

        checkCompletion();
      } else if (port.dataset.colorId !== colorId) {
        statusText.textContent = '❌ Warna tidak cocok! Hubungkan ke port dengan warna sama.';
      }
    };

    container.onpointerdown = (e) => {
      const pin = e.target.closest('.cable-pin');
      if (!pin) return;
      const colorId = pin.dataset.colorId;
      if (connected[colorId]) return;

      const rect = container.getBoundingClientRect();
      const pinRect = pin.querySelector('.cable-node').getBoundingClientRect();
      const startX = pinRect.left + pinRect.width / 2 - rect.left;
      const startY = pinRect.top + pinRect.height / 2 - rect.top;

      activeDrag = { colorId, startX, startY };
      tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('stroke', colors.find((c) => c.id === colorId).hex);
      tempPath.setAttribute('stroke-width', '8');
      tempPath.setAttribute('fill', 'none');
      tempPath.setAttribute('stroke-linecap', 'round');
      svgLayer.appendChild(tempPath);
    };

    container.onpointermove = (e) => {
      if (!activeDrag || !tempPath) return;
      const rect = container.getBoundingClientRect();
      const currX = e.clientX - rect.left;
      const currY = e.clientY - rect.top;

      const d = `M ${activeDrag.startX} ${activeDrag.startY} C ${activeDrag.startX + 80} ${activeDrag.startY}, ${currX - 80} ${currY}, ${currX} ${currY}`;
      tempPath.setAttribute('d', d);
    };

    const finishDrag = (e) => {
      if (!activeDrag) return;
      const rect = container.getBoundingClientRect();
      const ports = targetsCol.querySelectorAll('.rj45-port');
      let matched = false;

      ports.forEach((p) => {
        const pRect = p.getBoundingClientRect();
        const sock = p.querySelector('.port-socket');
        const sRect = sock.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (sRect.left + sRect.width / 2), e.clientY - (sRect.top + sRect.height / 2));

        if (dist < 55 && p.dataset.colorId === activeDrag.colorId) {
          // Connected!
          matched = true;
          connected[activeDrag.colorId] = true;
          sock.classList.add('connected');
          const targetX = sRect.left + sRect.width / 2 - rect.left;
          const targetY = sRect.top + sRect.height / 2 - rect.top;
          const d = `M ${activeDrag.startX} ${activeDrag.startY} C ${activeDrag.startX + 80} ${activeDrag.startY}, ${targetX - 80} ${targetY}, ${targetX} ${targetY}`;
          tempPath.setAttribute('d', d);
          playSound('click');
        }
      });

      if (!matched && tempPath) {
        tempPath.remove();
      }

      activeDrag = null;
      tempPath = null;
      checkCompletion();
    };

    function checkCompletion() {
      // Check all 4
      if (Object.keys(connected).length === 4) {
        statusText.textContent = '✅ SEMUA KABEL TERKONEKSI! LINK UP 100GbE.';
        statusText.className = 'status-indicator text-emerald';
        playSound('task_done');
        setTimeout(() => {
          document.getElementById('modal-task-patch-cord').classList.add('hidden');
          socket.emit('complete_task', { taskId: 'task-patch-cord' });
        }, 800);
      }
    }

    container.onpointerup = finishDrag;
    container.onpointercancel = finishDrag;
  }

  // --- TASK 2: DEPLOY HOTFIX KE PRODUCTION ---
  function initHotfixDeploy() {
    const step1 = document.getElementById('deploy-step-1');
    const step2 = document.getElementById('deploy-step-2');
    const step3 = document.getElementById('deploy-step-3');
    const btnRunTests = document.getElementById('btn-run-tests');
    const testProgress = document.getElementById('deploy-test-progress');
    const statusText = document.getElementById('deploy-status-text');

    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    testProgress.style.width = '0%';
    statusText.textContent = 'Menunggu inisiasi testing...';

    btnRunTests.onclick = () => {
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
      statusText.textContent = 'Menjalankan automated test suite...';
      playSound('click');

      let pct = 0;
      const interval = setInterval(() => {
        pct += 10;
        testProgress.style.width = `${pct}%`;
        if (pct >= 100) {
          clearInterval(interval);
          step2.classList.add('hidden');
          step3.classList.remove('hidden');
          statusText.textContent = 'Test Suite PASSED! Swipe atau klik slider untuk deploy.';
          initDeploySlider();
        }
      }, 100);
    };

    function initDeploySlider() {
      const track = document.getElementById('deploy-slider-track');
      const handle = document.getElementById('deploy-slider-handle');
      const fill = document.getElementById('deploy-slider-fill');
      let dragging = false;

      const trackRect = () => track.getBoundingClientRect();

      function triggerDeploySuccess() {
        handle.style.left = `calc(100% - 54px)`;
        fill.style.width = '100%';
        statusText.textContent = '🚀 DEPLOY SUCCESSFUL! K8S PODS UPDATED.';
        statusText.className = 'status-indicator text-emerald';
        playSound('task_done');
        setTimeout(() => {
          document.getElementById('modal-task-deploy-hotfix').classList.add('hidden');
          socket.emit('complete_task', { taskId: 'task-deploy-hotfix' });
        }, 700);
      }

      // Click on track anywhere on right side triggers deploy
      track.onclick = (e) => {
        const rect = trackRect();
        if (e.clientX - rect.left > rect.width * 0.45) {
          triggerDeploySuccess();
        }
      };

      handle.onpointerdown = (e) => {
        dragging = true;
        handle.setPointerCapture(e.pointerId);
      };

      handle.onpointermove = (e) => {
        if (!dragging) return;
        const rect = trackRect();
        const maxOffset = rect.width - 58;
        let offset = e.clientX - rect.left - 25;
        offset = Math.max(0, Math.min(offset, maxOffset));

        handle.style.left = `${offset + 4}px`;
        const pct = (offset / maxOffset) * 100;
        fill.style.width = `${pct}%`;

        if (pct > 85) {
          dragging = false;
          triggerDeploySuccess();
        }
      };

      const stopDrag = () => {
        if (!dragging) return;
        dragging = false;
        handle.style.left = '4px';
        fill.style.width = '0%';
      };
      handle.onpointerup = stopDrag;
      handle.onpointercancel = stopDrag;
    }
  }

  // --- TASK 3: RESTOCK BIJI KOPI PANTRY ---
  function initCoffeeRestock() {
    const btnPour = document.getElementById('btn-pour-coffee');
    const liquid = document.getElementById('coffee-liquid');
    const stream = document.getElementById('coffee-stream');
    const statusText = document.getElementById('coffee-status-text');

    let fillPct = 0;
    let pouring = false;
    let timer = null;

    liquid.style.height = '0%';
    stream.classList.add('hidden');
    statusText.textContent = 'Tahan (atau klik) tombol untuk mengisi mug...';
    statusText.className = 'status-indicator';

    function startPouring() {
      if (pouring) return;
      pouring = true;
      stream.classList.remove('hidden');
      timer = setInterval(() => {
        if (!pouring) return;
        fillPct = Math.min(100, fillPct + 2.0);
        liquid.style.height = `${fillPct}%`;

        if (fillPct >= 78 && fillPct <= 94) {
          statusText.textContent = '🎯 ZONA OPTIMAL! Lepaskan tombol sekarang!';
          statusText.className = 'status-indicator text-emerald';
        }
      }, 50);
    }

    function stopPouring() {
      if (!pouring) return;
      pouring = false;
      stream.classList.add('hidden');
      clearInterval(timer);

      // Target zone: 78% - 94%
      if (fillPct >= 78 && fillPct <= 94) {
        statusText.textContent = '☕ PERFECT CREMA! Biji kopi pantry terisi penuh.';
        statusText.className = 'status-indicator text-emerald';
        playSound('task_done');
        setTimeout(() => {
          document.getElementById('modal-task-restock-coffee').classList.add('hidden');
          socket.emit('complete_task', { taskId: 'task-restock-coffee' });
        }, 750);
      } else if (fillPct < 78) {
        statusText.textContent = 'Mug belum cukup terisi! Tahan lagi sampai zona optimal.';
        statusText.className = 'status-indicator text-amber';
      } else {
        statusText.textContent = 'Tumpah melebihi batas! Mengulang kembali...';
        statusText.className = 'status-indicator text-rose';
        fillPct = 0;
        liquid.style.height = '0%';
      }
    }

    // Both pointerdown/up (hold) and click toggle support
    btnPour.onpointerdown = (e) => {
      e.preventDefault();
      startPouring();
    };
    btnPour.onpointerup = (e) => {
      e.preventDefault();
      stopPouring();
    };
    btnPour.onpointercancel = (e) => {
      e.preventDefault();
      stopPouring();
    };
  }

  // --- TASK 4: RESTART CORE ROUTER ---
  function initRouterRestart() {
    const btnReboot = document.getElementById('btn-initiate-router-reboot');
    const fill = document.getElementById('router-reboot-fill');
    const secDisplay = document.getElementById('router-countdown-sec');
    const logs = document.getElementById('router-reboot-logs');
    const statusText = document.getElementById('router-status-text');

    fill.style.width = '0%';
    secDisplay.textContent = '5.0s';
    btnReboot.disabled = false;
    statusText.textContent = 'Menunggu inisiasi reboot...';

    btnReboot.onclick = () => {
      btnReboot.disabled = true;
      playSound('click');
      let remaining = 5.0;

      const logLines = [
        '[1.0s] Purging BGP routing tables & ARP cache...',
        '[2.5s] Hardware cold reboot sequence initiated...',
        '[3.8s] Re-establishing VLAN trunking & 100G links...',
        '[5.0s] Core Router Online (100% Traffic Stabilized)!'
      ];

      const interval = setInterval(() => {
        remaining -= 0.1;
        const progressPct = ((5.0 - remaining) / 5.0) * 100;
        fill.style.width = `${progressPct}%`;
        secDisplay.textContent = `${Math.max(0, remaining).toFixed(1)}s`;

        if (Math.abs(remaining - 4.0) < 0.05) logs.innerHTML += `<p>> ${logLines[0]}</p>`;
        if (Math.abs(remaining - 2.5) < 0.05) logs.innerHTML += `<p>> ${logLines[1]}</p>`;
        if (Math.abs(remaining - 1.2) < 0.05) logs.innerHTML += `<p>> ${logLines[2]}</p>`;

        if (remaining <= 0) {
          clearInterval(interval);
          logs.innerHTML += `<p class="text-emerald">> ${logLines[3]}</p>`;
          statusText.textContent = '⚡ ROUTER SELESAI DIREBOOT!';
          statusText.className = 'status-indicator text-emerald';
          playSound('task_done');
          setTimeout(() => {
            document.getElementById('modal-task-restart-router').classList.add('hidden');
            socket.emit('complete_task', { taskId: 'task-restart-router' });
          }, 800);
        }
      }, 100);
    };
  }

  // Sabotage Resolver Button
  document.getElementById('btn-resolve-sabotage').onclick = () => {
    socket.emit('repair_sabotage');
    playSound('task_done');
  };

  // ----------------------------------------------------------------------------
  // 7. CLIENT GAME LOOP & CANVAS RENDERING
  // ----------------------------------------------------------------------------
  let lastTime = performance.now();

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (currentGameState === 'PLAYING') {
      updateLocalPlayer(dt);
    }

    renderGame();
    requestAnimationFrame(gameLoop);
  }

  // Local movement & input resolution
  function updateLocalPlayer(dt) {
    if (inVent) return;

    // Cooldown decrement for Impostor
    if (myRole === 'impostor' && isAlive) {
      if (killCooldown > 0) {
        killCooldown = Math.max(0, killCooldown - dt);
        if (killCooldownOverlay && killCooldownNum) {
          killCooldownOverlay.classList.remove('hidden');
          killCooldownNum.textContent = Math.ceil(killCooldown);
        }
      } else {
        if (killCooldownOverlay) {
          killCooldownOverlay.classList.add('hidden');
        }
      }
    }

    let moveX = 0;
    let moveY = 0;

    // Keyboard inputs (case-insensitive & KeyCode support)
    if (keys['w'] || keys['W'] || keys['KeyW'] || keys['arrowup'] || keys['ArrowUp']) moveY -= 1;
    if (keys['s'] || keys['S'] || keys['KeyS'] || keys['arrowdown'] || keys['ArrowDown']) moveY += 1;
    if (keys['a'] || keys['A'] || keys['KeyA'] || keys['arrowleft'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['d'] || keys['D'] || keys['KeyD'] || keys['arrowright'] || keys['ArrowRight']) moveX += 1;

    // Combine with Joystick
    if (joystickActive) {
      moveX += joystickVector.x;
      moveY += joystickVector.y;
    }

    // If no keyboard/joystick, check click-to-move target
    let len = Math.hypot(moveX, moveY);
    if (len === 0 && targetPos) {
      const dx = targetPos.x - localPos.x;
      const dy = targetPos.y - localPos.y;
      const distTarget = Math.hypot(dx, dy);
      if (distTarget > 14) {
        moveX = dx / distTarget;
        moveY = dy / distTarget;
        len = 1;
      } else {
        targetPos = null;
      }
    } else if (len > 0) {
      targetPos = null; // Keyboard/joystick overrides click target
    }

    // Normalize
    if (len > 0) {
      const speed = isAlive ? PLAYER_SPEED : PLAYER_SPEED * 1.25;
      const vx = (moveX / Math.max(len, 1)) * speed;
      const vy = (moveY / Math.max(len, 1)) * speed;

      const nextX = localPos.x + vx * dt;
      const nextY = localPos.y + vy * dt;

      if (isPositionWalkable(nextX, nextY, !isAlive)) {
        localPos.x = nextX;
        localPos.y = nextY;
      } else if (isPositionWalkable(nextX, localPos.y, !isAlive)) {
        localPos.x = nextX;
      } else if (isPositionWalkable(localPos.x, nextY, !isAlive)) {
        localPos.y = nextY;
      }

      localPos.vx = vx;
      localPos.vy = vy;
      if (vx < -5) localPos.facing = 'left';
      if (vx > 5) localPos.facing = 'right';

      // Emit movement to server
      socket.emit('player_move', {
        x: Math.round(localPos.x),
        y: Math.round(localPos.y),
        vx: Math.round(vx),
        vy: Math.round(vy),
        facing: localPos.facing
      });
    } else {
      if (localPos.vx !== 0 || localPos.vy !== 0) {
        localPos.vx = 0;
        localPos.vy = 0;
        socket.emit('player_move', {
          x: Math.round(localPos.x),
          y: Math.round(localPos.y),
          vx: 0,
          vy: 0,
          facing: localPos.facing
        });
      }
    }

    // Determine current room for HUD
    const room = ROOMS_INFO.find(
      (r) =>
        localPos.x >= r.x - r.w / 2 &&
        localPos.x <= r.x + r.w / 2 &&
        localPos.y >= r.y - r.h / 2 &&
        localPos.y <= r.y + r.h / 2
    );
    if (hudCurrentRoom) {
      hudCurrentRoom.textContent = room ? room.name : '🌐 NETWORK CORRIDOR';
    }

    // Interaction checks
    updateInteractionPrompts();
  }

  function isPositionWalkable(x, y, isGhost = false) {
    if (x < 70 || x > MAP_WIDTH - 70 || y < 90 || y > MAP_HEIGHT - 70) {
      return false;
    }
    if (isGhost) return true;

    for (const obs of OBSTACLES) {
      if (x >= obs.x && x <= obs.x + obs.w && y >= obs.y && y <= obs.y + obs.h) {
        return false;
      }
    }
    return true;
  }

  function updateInteractionPrompts() {
    // 1. Check near task or emergency button
    nearestInteractable = null;
    let canUse = false;

    // Emergency button
    if (Math.hypot(localPos.x - EMERGENCY_BUTTON.x, localPos.y - EMERGENCY_BUTTON.y) <= EMERGENCY_BUTTON.radius) {
      canUse = true;
    }

    // Sabotage Console
    if (activeSabotage && activeSabotage.active) {
      if (Math.hypot(localPos.x - SABOTAGE_TERMINAL.x, localPos.y - SABOTAGE_TERMINAL.y) <= SABOTAGE_TERMINAL.radius) {
        canUse = true;
      }
    }

    // Tasks
    for (const t of TASK_DEFINITIONS) {
      if (Math.hypot(localPos.x - t.x, localPos.y - t.y) <= t.radius) {
        canUse = true;
        nearestInteractable = t;
        break;
      }
    }

    if (canUse) {
      btnActionUse.classList.add('active-target');
      btnActionUse.classList.remove('disabled');
    } else {
      btnActionUse.classList.remove('active-target');
      btnActionUse.classList.add('disabled');
    }

    // 2. Check dead bodies (BSOD Laptops) for REPORT
    nearestBody = null;
    for (const b of deadBodies) {
      if (Math.hypot(localPos.x - b.x, localPos.y - b.y) < 110) {
        nearestBody = b;
        break;
      }
    }
    if (nearestBody && isAlive) {
      btnActionReport.classList.add('active-body');
      btnActionReport.classList.remove('disabled');
    } else {
      btnActionReport.classList.remove('active-body');
      btnActionReport.classList.add('disabled');
    }

    // 3. Impostor: Check kill targets
    if (myRole === 'impostor' && isAlive) {
      nearestKillTarget = null;
      for (const id in remotePlayers) {
        if (id === myId) continue;
        const p = remotePlayers[id];
        if (p.isAlive && !p.isGhost) {
          const dist = Math.hypot(localPos.x - p.x, localPos.y - p.y);
          if (dist < 100) {
            nearestKillTarget = p;
            break;
          }
        }
      }

      if (nearestKillTarget && killCooldown <= 0) {
        btnActionKill.classList.add('ready');
        btnActionKill.classList.remove('disabled');
      } else {
        btnActionKill.classList.remove('ready');
        if (killCooldown > 0 || !nearestKillTarget) {
          btnActionKill.classList.add('disabled');
        }
      }
    } else {
      btnActionKill.classList.add('disabled');
    }

    // 4. Impostor: Check near vent
    if (myRole === 'impostor' && isAlive) {
      nearestVent = null;
      for (const v of VENTS) {
        if (Math.hypot(localPos.x - v.x, localPos.y - v.y) < 90) {
          nearestVent = v;
          break;
        }
      }
      if (nearestVent || inVent) {
        btnActionVent.classList.remove('disabled');
      } else {
        btnActionVent.classList.add('disabled');
      }
    } else {
      btnActionVent.classList.add('disabled');
    }
  }

  // ----------------------------------------------------------------------------
  // 8. CANVAS MAP & CHARACTERS RENDERING (ISOMETRIC CARTOON TECH OFFICE)
  // ----------------------------------------------------------------------------
  // Smoke & Fire particle pool for the burning office printer
  const particles = [];
  function updateAndDrawParticles(ctx) {
    // Spawn smoke above printer (at Task 1 location x: 1250, y: 560)
    if (Math.random() < 0.4) {
      particles.push({
        type: 'smoke',
        x: 1250 + (Math.random() - 0.5) * 20,
        y: 535,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1.2 - Math.random() * 0.8,
        radius: 6 + Math.random() * 6,
        alpha: 0.75,
        growth: 0.16
      });
    }
    // Spawn fire sparks
    if (Math.random() < 0.45) {
      particles.push({
        type: 'fire',
        x: 1250 + (Math.random() - 0.5) * 16,
        y: 545,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1.5 - Math.random() * 1.0,
        radius: 3 + Math.random() * 3,
        alpha: 1.0,
        color: Math.random() > 0.3 ? '#f97316' : '#facc15'
      });
    }

    // Update and render particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === 'smoke') {
        p.radius += p.growth;
        p.alpha -= 0.012;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(100, 116, 139, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fire') {
        p.alpha -= 0.035;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }
  }

  function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera following local player smoothly
    const targetCamX = localPos.x - canvas.width / 2;
    const targetCamY = localPos.y - canvas.height / 2;
    camera.x += (targetCamX - camera.x) * 0.15;
    camera.y += (targetCamY - camera.y) * 0.15;

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

    // 1. Draw Isometric Office Floor & Architecture
    drawIsometricOfficeFloor();

    // 2. Draw Office Rooms, Partition Cubicles & Meeting Room
    drawIsometricFurniture();

    // 3. Draw Smoking Printer Particles
    updateAndDrawParticles(ctx);

    // 4. Draw Task Stations & Interactive Markers
    drawInteractiveStations();

    // 5. Draw BSOD Laptops (Dead Bodies)
    drawDeadBodies();

    // 6. Draw Remote Players
    for (const id in remotePlayers) {
      if (id === myId) continue;
      const p = remotePlayers[id];
      if (p.inVent) continue; // Hidden in vent!
      renderCartoonOfficeCharacter(ctx, p.x, p.y, p.color, p.name, p.isGhost, p.facing, false, p.isBot);
    }

    // 7. Draw Local Player (if not hidden in vent)
    if (!inVent) {
      renderCartoonOfficeCharacter(
        ctx,
        localPos.x,
        localPos.y,
        selectedColor,
        'Anda',
        !isAlive,
        localPos.facing,
        true,
        false
      );
    }

    // 8. Draw Speech Bubbles
    drawCartoonSpeechBubbles();

    // 9. Sabotage Lights & Vision Mask
    drawSabotageOverlay();

    ctx.restore();
  }

  // Draw 2.5D Isometric Office Floor (Matching the Comic Style in the Screenshot)
  function drawIsometricOfficeFloor() {
    // Light clean office floor background
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Playable office floor with isometric grid line accents
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(70, 90, MAP_WIDTH - 140, MAP_HEIGHT - 160);

    // Floor grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    for (let x = 70; x < MAP_WIDTH - 70; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 90);
      ctx.lineTo(x, MAP_HEIGHT - 70);
      ctx.stroke();
    }
    for (let y = 90; y < MAP_HEIGHT - 70; y += 45) {
      ctx.beginPath();
      ctx.moveTo(70, y);
      ctx.lineTo(MAP_WIDTH - 70, y);
      ctx.stroke();
    }

    // Outer Isometric Office Border Walls with depth
    ctx.fillStyle = '#64748b';
    ctx.fillRect(50, 50, MAP_WIDTH - 100, 24); // Top wall depth
    ctx.fillStyle = '#475569';
    ctx.fillRect(50, 74, MAP_WIDTH - 100, 20); // Wall face

    // External glass windows on top wall with blue daylight frames
    for (let wx = 120; wx < MAP_WIDTH - 160; wx += 140) {
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(wx, 54, 80, 32);
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, 54, 80, 32);
      // Window glare
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + 10, 82);
      ctx.lineTo(wx + 45, 58);
      ctx.stroke();
    }
  }

  // Draw 2.5D Isometric Office Furniture (Meeting Room, 4-Way Cubicles, Pantry, Flaming Printer)
  function drawIsometricFurniture() {
    // =========================================================================
    // A. INCIDENT WAR ROOM / BOARDROOM (CENTER-TOP: x 520..880, y 110..330)
    // =========================================================================
    // Glass Partition Walls with Blue Window Panes around War Room
    ctx.fillStyle = 'rgba(191, 219, 254, 0.25)';
    ctx.fillRect(520, 105, 360, 225);

    // Blue-framed glass windows
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(520, 105, 360, 225);

    // Top window strips
    for (let gx = 530; gx < 860; gx += 55) {
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(gx, 108, 48, 28);
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx, 108, 48, 28);
    }

    // Large Wooden Boardroom Conference Table (Centered at x: 700, y: 220)
    const tableX = 580;
    const tableY = 160;
    const tableW = 240;
    const tableH = 120;

    // Table shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.roundRect(tableX + 6, tableY + 8, tableW, tableH, 18);
    ctx.fill();

    // Table wood surface
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(tableX, tableY, tableW, tableH, 18);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Wood bevel inner highlight
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tableX + 4, tableY + 4, tableW - 8, tableH - 8, 14);
    ctx.stroke();

    // Stencil / Chalk Text: "EMERGENCY MEETING" printed on table surface
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '900 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(tableX + 75, tableY + 62);
    ctx.rotate(-0.06);
    ctx.fillText('EMERGENCY', 0, -4);
    ctx.fillText('MEETING', 0, 14);
    ctx.restore();

    // Big Red Emergency Push Button on Table (Centered at x: 700, y: 220)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(EMERGENCY_BUTTON.x + 35, EMERGENCY_BUTTON.y - 18, 40, 40, 8);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red button mushroom head
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(EMERGENCY_BUTTON.x + 55, EMERGENCY_BUTTON.y + 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Black Executive Swivel Chairs around Boardroom Table
    const chairPositions = [
      // Top row chairs
      { x: tableX + 25, y: tableY - 14 },
      { x: tableX + 75, y: tableY - 14 },
      { x: tableX + 125, y: tableY - 14 },
      { x: tableX + 175, y: tableY - 14 },
      { x: tableX + 215, y: tableY - 14 },
      // Bottom row chairs
      { x: tableX + 25, y: tableY + tableH + 8 },
      { x: tableX + 75, y: tableY + tableH + 8 },
      { x: tableX + 125, y: tableY + tableH + 8 },
      { x: tableX + 175, y: tableY + tableH + 8 },
      { x: tableX + 215, y: tableY + tableH + 8 }
    ];

    chairPositions.forEach((pos) => {
      // Chair base & swivel arm
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(pos.x - 10, pos.y - 10, 20, 20, 5);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Chair backrest
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(pos.x - 8, pos.y - 8, 16, 6, 2);
      ctx.fill();
    });

    // =========================================================================
    // B. DEV OPEN SPACE: 4-WAY CUBICLE WORKSTATIONS (WEST: x 110..430, y 260..680)
    // =========================================================================
    const cubicles = [
      { x: 160, y: 310, w: 220, h: 170 },
      { x: 160, y: 500, w: 220, h: 160 }
    ];

    cubicles.forEach((c) => {
      // Light-grey fabric divider partitions (4-way cross divider)
      ctx.fillStyle = '#94a3b8';
      // Horizontal partition
      ctx.fillRect(c.x, c.y + c.h / 2 - 4, c.w, 8);
      // Vertical partition
      ctx.fillRect(c.x + c.w / 2 - 4, c.y, 8, c.h);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y + c.h / 2 - 4, c.w, 8);
      ctx.strokeRect(c.x + c.w / 2 - 4, c.y, 8, c.h);

      // Colorful Post-It Notes on partition walls
      ctx.fillStyle = '#fde047'; // Yellow post-it
      ctx.fillRect(c.x + 35, c.y + c.h / 2 - 12, 10, 10);
      ctx.fillStyle = '#f472b6'; // Pink post-it
      ctx.fillRect(c.x + 55, c.y + c.h / 2 - 12, 10, 10);
      ctx.fillStyle = '#67e8f9'; // Cyan post-it
      ctx.fillRect(c.x + c.w / 2 + 10, c.y + 30, 10, 10);

      // Desks inside quadrants
      const deskOffsets = [
        { dx: 15, dy: 15 },
        { dx: c.w / 2 + 10, dy: 15 },
        { dx: 15, dy: c.h / 2 + 10 },
        { dx: c.w / 2 + 10, dy: c.h / 2 + 10 }
      ];

      deskOffsets.forEach((d) => {
        // Wooden desk surface
        ctx.fillStyle = '#d97706';
        ctx.fillRect(c.x + d.dx, c.y + d.dy, 75, 42);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x + d.dx, c.y + d.dy, 75, 42);

        // Desktop Computer Monitor
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c.x + d.dx + 18, c.y + d.dy + 6, 36, 20);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x + d.dx + 18, c.y + d.dy + 6, 36, 20);

        // Screen code text lines
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c.x + d.dx + 22, c.y + d.dy + 10, 20, 2);
        ctx.fillRect(c.x + d.dx + 22, c.y + d.dy + 14, 26, 2);

        // Keyboard
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(c.x + d.dx + 22, c.y + d.dy + 30, 22, 6);
      });
    });

    // =========================================================================
    // C. PANTRY & WATER COOLER (SOUTH: x 510..890, y 730..950)
    // =========================================================================
    // Kitchenette Coffee Bar Counter (at x: 550, y: 770)
    ctx.fillStyle = '#b45309';
    ctx.fillRect(620, 810, 160, 60);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(620, 810, 160, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☕ COFFEE BAR', 700, 845);

    // Water Dispenser (Galon Aqua with blue inverted bottle at x: 550, y: 770)
    const dispX = 540;
    const dispY = 760;
    // Dispenser white base unit
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(dispX, dispY, 32, 54);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(dispX, dispY, 32, 54);

    // Blue & Red Water Taps
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(dispX + 8, dispY + 28, 5, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(dispX + 18, dispY + 28, 5, 8);

    // Blue Inverted 19-Liter Water Bottle (Galon Aqua)
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.roundRect(dispX + 2, dispY - 32, 28, 34, 10);
    ctx.fill();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Water bottle gloss reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.roundRect(dispX + 6, dispY - 28, 6, 24, 3);
    ctx.fill();

    // Potted Office Plant next to water dispenser
    ctx.fillStyle = '#b45309'; // Clay pot
    ctx.beginPath();
    ctx.moveTo(dispX + 44, dispY + 45);
    ctx.lineTo(dispX + 62, dispY + 45);
    ctx.lineTo(dispX + 59, dispY + 28);
    ctx.lineTo(dispX + 47, dispY + 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Plant green leaves
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(dispX + 53, dispY + 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dispX + 45, dispY + 24, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dispX + 61, dispY + 24, 8, 0, Math.PI * 2);
    ctx.fill();

    // =========================================================================
    // D. SERVER ROOM & SMOKING PRINTER (EAST: x 970..1290, y 260..680)
    // =========================================================================
    // Server Racks with Blinking LEDs (at x: 1080..1180, y: 390)
    [ { x: 1080, y: 390, w: 70, h: 180 }, { x: 1180, y: 390, w: 70, h: 180 } ].forEach((rack) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rack.x, rack.y, rack.w, rack.h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(rack.x, rack.y, rack.w, rack.h);

      for (let y = rack.y + 15; y < rack.y + rack.h - 15; y += 18) {
        ctx.fillStyle = Math.random() > 0.3 ? '#10b981' : '#f59e0b';
        ctx.fillRect(rack.x + 10, y, 6, 6);
        ctx.fillStyle = Math.random() > 0.4 ? '#06b6d4' : '#10b981';
        ctx.fillRect(rack.x + 22, y, 6, 6);
      }
    });

    // Core Router Faceplate (Task 4 at x: 1250, y: 330)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(1230, 310, 44, 44, 6);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.fillRect(1236, 320, 6, 6);
    ctx.fillRect(1246, 320, 6, 6);
    ctx.fillRect(1256, 320, 6, 6);

    // SMOKING BROKEN PRINTER / PHOTOCOPIER (Task 1 at x: 1250, y: 560)
    const prnX = 1230;
    const prnY = 540;

    // Printer Body
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(prnX, prnY, 46, 50, 6);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Scanner Dark Glass Lid
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(prnX + 4, prnY + 4, 38, 12);

    // Paper output tray with paper sheets
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(prnX + 6, prnY + 22, 34, 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(prnX + 10, prnY + 24, 26, 8);

    // Little Yellow Panicking Engineer standing by the smoking printer
    renderCartoonOfficeCharacter(ctx, prnX - 24, prnY + 25, { hex: '#eab308' }, 'QA Tech', false, 'right', false, true);

    // Speech bubble for the panicking engineer
    renderSpeechBubble(ctx, '...', prnX - 24, prnY - 20);
  }

  // Comic Speech Bubble Renderer
  function renderSpeechBubble(c, text, x, y) {
    c.save();
    c.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textWidth = c.measureText(text).width;
    const bubbleW = textWidth + 18;
    const bubbleH = 24;

    // Bubble white background with black outline
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.roundRect(x - bubbleW / 2, y - bubbleH, bubbleW, bubbleH, 12);
    c.fill();
    c.strokeStyle = '#0f172a';
    c.lineWidth = 2.2;
    c.stroke();

    // Little triangular pointer tail
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x - 5, y);
    c.lineTo(x + 5, y);
    c.lineTo(x, y + 6);
    c.closePath();
    c.fill();
    c.strokeStyle = '#0f172a';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x - 5, y);
    c.lineTo(x, y + 6);
    c.lineTo(x + 5, y);
    c.stroke();

    // Bubble Text
    c.fillStyle = '#0f172a';
    c.textAlign = 'center';
    c.fillText(text, x, y - 8);
    c.restore();
  }

  function drawCartoonSpeechBubbles() {
    // Show 'SLACK!' speech bubble above Impostor (matching the screenshot!)
    if (myRole === 'impostor' && isAlive && !inVent) {
      renderSpeechBubble(ctx, 'SLACK!', localPos.x, localPos.y - 48);
    }
  }

  // Draw Interactive Station Markers
  function drawInteractiveStations() {
    const time = performance.now() * 0.003;

    // Tasks
    TASK_DEFINITIONS.forEach((t) => {
      const isDone = myTasksCompleted.includes(t.id);
      ctx.fillStyle = isDone ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.3)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 24 + Math.sin(time) * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isDone ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isDone ? '✓' : '🛠️', t.x, t.y + 5);
    });

    // Vents (Visible to Impostor or when close)
    VENTS.forEach((v) => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(v.x - 18, v.y - 12, 36, 24);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(v.x - 18, v.y - 12, 36, 24);

      // Vent slats
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      for (let vx = v.x - 12; vx <= v.x + 12; vx += 6) {
        ctx.beginPath();
        ctx.moveTo(vx, v.y - 8);
        ctx.lineTo(vx, v.y + 8);
        ctx.stroke();
      }
    });

    // Sabotage Console
    if (activeSabotage && activeSabotage.active) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.beginPath();
      ctx.arc(SABOTAGE_TERMINAL.x, SABOTAGE_TERMINAL.y, 30 + Math.sin(time * 3) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️', SABOTAGE_TERMINAL.x, SABOTAGE_TERMINAL.y + 6);
    }
  }

  // Draw Dead Bodies (Laptops with Blue Screen of Death / BSOD)
  function drawDeadBodies() {
    deadBodies.forEach((b) => {
      // Glowing Blue Aura on Floor
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 32, 0, Math.PI * 2);
      ctx.fill();

      // Fallen Laptop Body
      ctx.fillStyle = '#334155';
      ctx.fillRect(b.x - 16, b.y - 10, 32, 20);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 16, b.y - 10, 32, 20);

      // Glowing Blue BSOD Screen
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(b.x - 13, b.y - 20, 26, 15);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x - 13, b.y - 20, 26, 15);

      // Sad Face :( on screen
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(':(', b.x, b.y - 10);

      // Victim badge name
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px "Plus Jakarta Sans"';
      ctx.fillText(`BSOD: ${b.victimName}`, b.x, b.y + 24);
    });
  }

  // Render Cute Cartoon Office Coworkers & The Impostor
  function renderCartoonOfficeCharacter(c, x, y, color, name, isGhost, facing, isSelf = false, isBot = false) {
    c.save();
    c.translate(x, y);

    if (isGhost) {
      c.globalAlpha = 0.45;
    }

    // Direction flip
    if (facing === 'left') {
      c.scale(-1, 1);
    }

    // Drop Shadow
    c.fillStyle = 'rgba(0, 0, 0, 0.25)';
    c.beginPath();
    c.ellipse(0, 18, 14, 6, 0, 0, Math.PI * 2);
    c.fill();

    // IF THIS IS AN IMPOSTOR DISGUISED AS AMONG US BEAN (Exact match to the screenshot in the center!)
    if ((isSelf && myRole === 'impostor') || color.hex === '#f43f5e' || color.hex === '#ef4444') {
      // Classic Red Among Us Suit
      c.fillStyle = '#ef4444';
      c.beginPath();
      // Legs & Torso
      c.roundRect(-14, -22, 28, 38, 14);
      c.fill();
      c.strokeStyle = '#1e293b';
      c.lineWidth = 2.5;
      c.stroke();

      // Backpack
      c.fillStyle = '#dc2626';
      c.beginPath();
      c.roundRect(-20, -12, 8, 22, 4);
      c.fill();
      c.stroke();

      // Cyan Visor
      c.fillStyle = '#38bdf8';
      c.beginPath();
      c.roundRect(1, -16, 16, 12, 6);
      c.fill();
      c.strokeStyle = '#1e293b';
      c.lineWidth = 2.2;
      c.stroke();

      // Visor White Highlight
      c.fillStyle = 'rgba(255, 255, 255, 0.8)';
      c.beginPath();
      c.ellipse(7, -12, 4, 2, -0.2, 0, Math.PI * 2);
      c.fill();
    } else {
      // Cute Cartoon Office Coworker (Polo Shirt, Hair, ID Card, Smile!)
      // Legs & Shoes
      c.fillStyle = '#1e293b'; // Dark trousers
      c.fillRect(-8, 8, 6, 12);
      c.fillRect(2, 8, 6, 12);
      ctx.fillStyle = '#0f172a'; // Shoes
      c.fillRect(-9, 17, 8, 4);
      c.fillRect(2, 17, 8, 4);

      // Torso / Polo Shirt (Color of player)
      c.fillStyle = color.hex || '#3b82f6';
      c.beginPath();
      c.roundRect(-12, -10, 24, 20, 6);
      c.fill();
      c.strokeStyle = '#1e293b';
      c.lineWidth = 2.2;
      c.stroke();

      // Polo Collar & ID Badge
      c.fillStyle = '#ffffff';
      c.fillRect(-2, -6, 5, 8); // White ID card
      c.fillStyle = '#f59e0b';
      c.fillRect(-2, -7, 5, 2); // Yellow lanyard clip

      // Cartoon Head / Face
      c.fillStyle = '#fed7aa'; // Skin tone
      c.beginPath();
      c.arc(0, -18, 12, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#1e293b';
      c.lineWidth = 2.2;
      c.stroke();

      // Cartoon Eyes
      c.fillStyle = '#0f172a';
      c.beginPath();
      c.arc(3, -19, 2, 0, Math.PI * 2);
      c.arc(8, -19, 2, 0, Math.PI * 2);
      c.fill();

      // Cartoon Hair (Black / Dark Brown)
      c.fillStyle = '#1e293b';
      c.beginPath();
      c.arc(0, -22, 12, Math.PI, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    c.restore();

    // Name Overhead Tag
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = isSelf ? 'bold 12px "Plus Jakarta Sans"' : 'bold 11px "Plus Jakarta Sans"';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y - 34);

    if (isSelf) {
      // Cyan marker arrow above head
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(x, y - 44);
      ctx.lineTo(x - 5, y - 52);
      ctx.lineTo(x + 5, y - 52);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sabotage Lighting & Vision Mask Overlay
  function drawSabotageOverlay() {
    if (activeSabotage && activeSabotage.active) {
      // Dark Red Siren Alert
      const time = performance.now() * 0.004;
      const alpha = 0.28 + Math.sin(time) * 0.16;
      ctx.fillStyle = `rgba(225, 29, 72, ${alpha})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // If Dev, apply reduced field of view flashlight radius
      if (myRole === 'dev' && isAlive) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const grad = ctx.createRadialGradient(localPos.x, localPos.y, 40, localPos.x, localPos.y, 220);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(localPos.x, localPos.y, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 9. INITIALIZATION
  // ----------------------------------------------------------------------------
  initLobbyUI();
  requestAnimationFrame(gameLoop);

})();
