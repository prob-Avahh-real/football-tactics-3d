import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FORMATIONS, getFormationPositions } from '../lib/formations.js';
import { stepBall, stepPlayer, goalProbability, resolveGoal, classifyOutOfBounds, setPieceBallPosition, kickoffBallPosition, validateGoalSide, FIELD_HALF_X } from '../lib/matchSim.js';

// Game State
const gameState = {
    homeTeam: null,
    awayTeam: null,
    homeScore: 0,
    awayScore: 0,
    matchTime: 0,
    matchStatus: 'preparing', // preparing, first_half, half_time, second_half, finished
    isPaused: false,
    substitutionsRemaining: 3,
    selectedFormation: '4-3-3',
    awayFormation: '4-3-3',
    startingEleven: [],
    bench: [],
    awayLineup: [],
    selectedPlayerOut: null,
    selectedPlayerIn: null,
    kickoffFrames: 0,
    setPieceFreeze: 0,
    lastSetPiece: null,
};

const teams = [
    { id: 1, name: '曼联', color: 0xDA291C, players: null },
    { id: 2, name: '曼城', color: 0x6CABDD, players: null },
    { id: 3, name: '利物浦', color: 0xC8102E, players: null },
    { id: 4, name: '切尔西', color: 0x034694, players: null },
    { id: 5, name: '阿森纳', color: 0xEF0107, players: null },
    { id: 6, name: '热刺', color: 0x132257, players: null },
];

for (const team of teams) {
    team.players = generatePlayers(team.name);
}

const AWAY_FORMATIONS = Object.keys(FORMATIONS);

function generatePlayers(teamName) {
    const positions = [
        'GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW',
        'GK', 'CB', 'CM', 'ST', 'LW', 'CM', 'CB', 'RB', 'ST',
    ];
    const firstNames = ['克里斯', '马库斯', '布鲁诺', '凯文', '穆罕默德', '厄林', '哈里', '孙兴慜', '维吉尔', '萨卡'];
    const lastNames = ['罗纳尔多', '拉什福德', '费尔南德斯', '德布劳内', '萨拉赫', '哈兰德', '凯恩', '范戴克', '亨德森'];

    return positions.map((pos, i) => ({
        id: i + 1,
        name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        teamName,
        position: pos,
        rating: Math.floor(Math.random() * 20) + 75,
        stamina: 100,
        speed: Math.floor(Math.random() * 30) + 70,
        shooting: Math.floor(Math.random() * 30) + 70,
        passing: Math.floor(Math.random() * 30) + 70,
        defense: Math.floor(Math.random() * 30) + 70,
    }));
}

let scene, camera, renderer, controls;
let playerMeshes = [];
let ballMesh;
let animationId;

function initThreeJS() {
    const container = document.getElementById('scene-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 30, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 15;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    createField();
    window.addEventListener('resize', onWindowResize);
    animate();
}

function createField() {
    const fieldWidth = 30;
    const fieldLength = 45;

    const grassGeometry = new THREE.PlaneGeometry(fieldWidth + 10, fieldLength + 10);
    const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.1;
    grass.receiveShadow = true;
    scene.add(grass);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

    const boundaryPoints = [
        new THREE.Vector3(-fieldWidth / 2, 0, -fieldLength / 2),
        new THREE.Vector3(fieldWidth / 2, 0, -fieldLength / 2),
        new THREE.Vector3(fieldWidth / 2, 0, fieldLength / 2),
        new THREE.Vector3(-fieldWidth / 2, 0, fieldLength / 2),
        new THREE.Vector3(-fieldWidth / 2, 0, -fieldLength / 2),
    ];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundaryPoints), lineMaterial));

    const centerLinePoints = [
        new THREE.Vector3(-fieldWidth / 2, 0, 0),
        new THREE.Vector3(fieldWidth / 2, 0, 0),
    ];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerLinePoints), lineMaterial));

    const circleGeometry = new THREE.RingGeometry(2.9, 3, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const centerCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.01;
    scene.add(centerCircle);

    createGoal(-fieldWidth / 2 - 2, 0, 0, 0xDA291C);
    createGoal(fieldWidth / 2 + 2, 0, 0, 0x6CABDD);

    createPenaltyArea(-fieldWidth / 2, 0, -fieldLength / 2);
    createPenaltyArea(fieldWidth / 2, 0, -fieldLength / 2);
    createPenaltyArea(-fieldWidth / 2, 0, fieldLength / 2);
    createPenaltyArea(fieldWidth / 2, 0, fieldLength / 2);
}

function createGoal(x, y, z, color) {
    const goalGeometry = new THREE.BoxGeometry(2, 3, 0.5);
    const goalMaterial = new THREE.MeshLambertMaterial({ color });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(x, 1.5, z);
    scene.add(goal);

    const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3);
    const postMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

    const leftPost = new THREE.Mesh(postGeometry, postMaterial);
    leftPost.position.set(x - 1, 1.5, z);
    scene.add(leftPost);

    const rightPost = new THREE.Mesh(postGeometry, postMaterial);
    rightPost.position.set(x + 1, 1.5, z);
    scene.add(rightPost);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2), postMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(x, 3, z);
    scene.add(crossbar);
}

function createPenaltyArea(x, y, z) {
    const areaGeometry = new THREE.BoxGeometry(4, 0.05, 8);
    const areaMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const area = new THREE.Mesh(areaGeometry, areaMaterial);
    area.position.set(x > 0 ? x - 2 : x + 2, 0.02, z);
    scene.add(area);
}

function createPlayerMesh(player, x, z, color, team, role) {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8);
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.75, z);
    mesh.castShadow = true;
    mesh.userData = {
        player,
        team,
        role: role || player.position,
        originalPosition: { x, z },
    };
    scene.add(mesh);
    return mesh;
}

function createBall() {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.position.set(0, 0.3, 0);
    ballMesh.castShadow = true;
    scene.add(ballMesh);
}

function onWindowResize() {
    const container = document.getElementById('scene-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    animationId = requestAnimationFrame(animate);

    if (!gameState.isPaused && gameState.matchStatus !== 'preparing' && gameState.matchStatus !== 'finished') {
        updateMatch();
    }

    controls?.update();
    renderer.render(scene, camera);
}

function initializeUI() {
    document.getElementById('btn-team-select').addEventListener('click', showTeamModal);
    document.getElementById('btn-close-team').addEventListener('click', () => hideModal('team-modal'));
    document.getElementById('btn-confirm-team').addEventListener('click', confirmTeamSelection);

    document.getElementById('btn-tactics').addEventListener('click', showTacticsModal);
    document.getElementById('btn-close-tactics').addEventListener('click', () => hideModal('tactics-modal'));
    document.getElementById('btn-confirm-tactics').addEventListener('click', confirmTactics);

    document.getElementById('btn-start-match').addEventListener('click', startMatch);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-substitutions').addEventListener('click', showSubstitutionModal);

    document.getElementById('btn-close-sub').addEventListener('click', () => hideModal('substitution-modal'));
    document.getElementById('btn-confirm-sub').addEventListener('click', confirmSubstitution);

    populateTeamList();
    populateFormations();
}

function showTeamModal() {
    document.getElementById('team-modal').classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function populateTeamList() {
    const teamList = document.getElementById('team-list');
    teamList.innerHTML = '';

    teams.forEach((team) => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <h3>${team.name}</h3>
            <p>平均评分: ${Math.floor(team.players.reduce((sum, p) => sum + p.rating, 0) / team.players.length)}</p>
        `;
        card.addEventListener('click', () => selectTeam(team, card));
        teamList.appendChild(card);
    });
}

function selectTeam(team, card) {
    document.querySelectorAll('.team-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    gameState.homeTeam = team;
}

function confirmTeamSelection() {
    if (!gameState.homeTeam) {
        alert('请选择一支球队');
        return;
    }

    const availableTeams = teams.filter((t) => t.id !== gameState.homeTeam.id);
    gameState.awayTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    gameState.awayFormation = AWAY_FORMATIONS[Math.floor(Math.random() * AWAY_FORMATIONS.length)];
    gameState.awayLineup = gameState.awayTeam.players.slice(0, 11);

    hideModal('team-modal');
    document.getElementById('btn-start-match').disabled = false;
    document.getElementById('match-status').textContent =
        `已选择: ${gameState.homeTeam.name} vs ${gameState.awayTeam.name}`;
}

function showTacticsModal() {
    if (!gameState.homeTeam) {
        alert('请先选择球队');
        return;
    }

    populatePlayerSelection();
    document.getElementById('tactics-modal').classList.remove('hidden');
}

function populateFormations() {
    const formationGrid = document.getElementById('formation-grid');
    formationGrid.innerHTML = '';

    Object.keys(FORMATIONS).forEach((formation) => {
        const btn = document.createElement('div');
        btn.className = 'formation-btn' + (formation === gameState.selectedFormation ? ' selected' : '');
        btn.textContent = formation;
        btn.addEventListener('click', () => selectFormation(formation, btn));
        formationGrid.appendChild(btn);
    });
}

function selectFormation(formation, btn) {
    document.querySelectorAll('.formation-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    gameState.selectedFormation = formation;
}

function populatePlayerSelection() {
    const startingEleven = document.getElementById('starting-eleven');
    startingEleven.innerHTML = '';

    gameState.homeTeam.players.forEach((player) => {
        const item = document.createElement('div');
        item.className = 'player-item' + (gameState.startingEleven.includes(player) ? ' selected' : '');
        item.innerHTML = `
            <span>${player.name} (${player.position})</span>
            <span>评分: ${player.rating}</span>
        `;
        item.addEventListener('click', () => togglePlayerSelection(player, item));
        startingEleven.appendChild(item);
    });
}

function togglePlayerSelection(player, item) {
    if (gameState.startingEleven.includes(player)) {
        gameState.startingEleven = gameState.startingEleven.filter((p) => p.id !== player.id);
        item.classList.remove('selected');
    } else if (gameState.startingEleven.length < 11) {
        gameState.startingEleven.push(player);
        item.classList.add('selected');
    }
}

function confirmTactics() {
    if (gameState.startingEleven.length !== 11) {
        alert('请选择11名首发球员');
        return;
    }

    gameState.bench = gameState.homeTeam.players.filter((p) => !gameState.startingEleven.includes(p));
    hideModal('tactics-modal');
    createPlayersOnField();

    if (gameState.matchStatus === 'half_time') {
        resetKickoff('中场休息结束 — 点击继续开始下半场');
    }
}

function createPlayersOnField() {
    playerMeshes.forEach((mesh) => scene.remove(mesh));
    playerMeshes = [];

    if (!ballMesh) createBall();

    const homeRoles = FORMATIONS[gameState.selectedFormation].positions;
    const homePositions = getFormationPositions(homeRoles, -10, 'home');

    gameState.startingEleven.forEach((player, i) => {
        const pos = homePositions[i];
        const role = homeRoles[i];
        const mesh = createPlayerMesh(player, pos.x, pos.z, gameState.homeTeam.color, 'home', role);
        playerMeshes.push(mesh);
    });

    const awayRoles = FORMATIONS[gameState.awayFormation].positions;
    const awayPositions = getFormationPositions(awayRoles, 10, 'away');
    const awayPlayers = gameState.awayLineup.length ? gameState.awayLineup : gameState.awayTeam.players.slice(0, 11);

    awayPlayers.forEach((player, i) => {
        const pos = awayPositions[i];
        const role = awayRoles[i];
        const mesh = createPlayerMesh(player, pos.x, pos.z, gameState.awayTeam.color, 'away', role);
        playerMeshes.push(mesh);
    });
}

/** Reset ball + players to formation for kickoff / after goal / half. */
function resetKickoff(statusText) {
    if (!ballMesh) createBall();
    const c = kickoffBallPosition();
    ballMesh.position.set(c.x, 0.3, c.z);

    playerMeshes.forEach((mesh) => {
        const slot = mesh.userData.originalPosition;
        mesh.position.x = slot.x;
        mesh.position.z = slot.z;
    });

    gameState.kickoffFrames = 90; // ~1.5s freeze at centre
    gameState.setPieceFreeze = 0;
    gameState.lastSetPiece = null;
    if (statusText) {
        document.getElementById('match-status').textContent = statusText;
    }
}

function applySetPiece(piece, label) {
    const pos = setPieceBallPosition(piece);
    ballMesh.position.set(pos.x, 0.3, pos.z);
    gameState.lastSetPiece = piece;
    gameState.setPieceFreeze = 45;
    document.getElementById('match-status').textContent = label;
}

function startMatch() {
    if (!gameState.homeTeam || gameState.startingEleven.length !== 11) {
        alert('请先选择球队和战术');
        return;
    }

    if (!playerMeshes.length) createPlayersOnField();

    gameState.matchStatus = 'first_half';
    gameState.matchTime = 0;
    gameState.isPaused = false;

    document.getElementById('btn-start-match').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    document.getElementById('btn-substitutions').disabled = false;
    document.getElementById('btn-tactics').disabled = true;
    document.getElementById('btn-team-select').disabled = true;

    resetKickoff('开球');
}

function togglePause() {
    // Half-time → second half when user unpauses
    if (gameState.matchStatus === 'half_time' && gameState.isPaused) {
        gameState.matchStatus = 'second_half';
        gameState.isPaused = false;
        document.getElementById('btn-tactics').disabled = true;
        createPlayersOnField();
        resetKickoff('下半场开球');
        document.getElementById('btn-pause').textContent = '暂停';
        return;
    }

    gameState.isPaused = !gameState.isPaused;
    document.getElementById('btn-pause').textContent = gameState.isPaused ? '继续' : '暂停';
    document.getElementById('match-status').textContent = gameState.isPaused ? '暂停' : getMatchStatusText();
}

function getMatchStatusText() {
    switch (gameState.matchStatus) {
        case 'first_half':
            return '上半场进行中';
        case 'half_time':
            return '中场休息';
        case 'second_half':
            return '下半场进行中';
        case 'finished':
            return '比赛结束';
        default:
            return '准备开始';
    }
}

function playersNearBall(radius = 8) {
    if (!ballMesh) return [];
    return playerMeshes
        .filter((mesh) => mesh.position.distanceTo(ballMesh.position) < radius)
        .map((mesh) => ({
            ...mesh.userData.player,
            team: mesh.userData.team,
            role: mesh.userData.role,
            position: mesh.userData.role || mesh.userData.player.position,
            x: mesh.position.x,
            z: mesh.position.z,
        }));
}

function updateMatch() {
    if (gameState.matchStatus === 'half_time') return;

    gameState.matchTime += 1 / 60;

    const minutes = Math.floor(gameState.matchTime);
    const seconds = Math.floor((gameState.matchTime % 1) * 60);
    document.getElementById('match-timer').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (gameState.kickoffFrames > 0) {
        gameState.kickoffFrames--;
        // Hold shape; only allow slight approach by kickoff side ST
        simulatePlayerMovement({ kickoff: true });
        if (gameState.kickoffFrames === 0) {
            document.getElementById('match-status').textContent = getMatchStatusText();
        }
        return;
    }

    if (gameState.setPieceFreeze > 0) {
        gameState.setPieceFreeze--;
        simulatePlayerMovement({ setPiece: gameState.lastSetPiece });
        if (gameState.setPieceFreeze === 0) {
            document.getElementById('match-status').textContent = getMatchStatusText();
        }
        return;
    }

    simulateBallMovement();
    simulatePlayerMovement();
    maybeScore();

    if (gameState.matchTime >= 45 && gameState.matchStatus === 'first_half') {
        gameState.matchStatus = 'half_time';
        gameState.isPaused = true;
        document.getElementById('btn-pause').textContent = '继续';
        document.getElementById('match-status').textContent = '中场休息 — 可调整战术，点继续开下半场';
        document.getElementById('btn-tactics').disabled = false;
        document.getElementById('btn-substitutions').disabled = false;
        resetKickoff();
    }

    if (gameState.matchTime >= 90 && gameState.matchStatus === 'second_half') {
        gameState.matchStatus = 'finished';
        gameState.isPaused = true;
        document.getElementById('match-status').textContent = '比赛结束';
        document.getElementById('btn-pause').disabled = true;
        document.getElementById('btn-substitutions').disabled = true;
    }
}

function simulateBallMovement() {
    if (!ballMesh) return;

    const prev = { x: ballMesh.position.x, z: ballMesh.position.z };
    const near = playersNearBall(8);
    const next = stepBall(prev, near);

    // Goal mouth crossed → try score path instead of set piece
    if (Math.abs(next.x) > FIELD_HALF_X && Math.abs(next.z) <= 3.5) {
        ballMesh.position.x = Math.sign(next.x) * FIELD_HALF_X;
        ballMesh.position.z = next.z;
        const side = next.x > 0 ? 'home' : 'away';
        if (validateGoalSide(side, near, next)) {
            simulateGoal(side);
        } else {
            document.getElementById('match-status').textContent = '越位在先，进球无效';
            applySetPiece(
                {
                    kind: 'goal_kick',
                    restartTeam: side === 'home' ? 'away' : 'home',
                    x: next.x,
                    z: 0,
                },
                '越位 — 球门球'
            );
        }
        return;
    }

    const piece = classifyOutOfBounds(prev, next);
    if (piece) {
        const labels = {
            throw_in: '界外球',
            corner: '角球',
            goal_kick: '球门球',
        };
        applySetPiece(piece, labels[piece.kind] || '定位球');
        return;
    }

    ballMesh.position.x = next.x;
    ballMesh.position.z = next.z;
    ballMesh.rotation.x += 0.08;
    ballMesh.rotation.z += 0.08;
}

function simulatePlayerMovement(opts = {}) {
    if (!ballMesh) return;
    const ball = { x: ballMesh.position.x, z: ballMesh.position.z };

    playerMeshes.forEach((mesh) => {
        const player = {
            ...mesh.userData.player,
            team: mesh.userData.team,
        };
        const role = mesh.userData.role;

        if (opts.kickoff) {
            // Stay near slot during kickoff; ST may creep toward centre
            if (role === 'ST') {
                const next = stepPlayer(
                    { x: mesh.position.x, z: mesh.position.z },
                    mesh.userData.originalPosition,
                    ball,
                    player,
                    role
                );
                mesh.position.x = mesh.userData.originalPosition.x * 0.7 + next.x * 0.3;
                mesh.position.z = mesh.userData.originalPosition.z * 0.7 + next.z * 0.3;
            } else {
                mesh.position.x = mesh.userData.originalPosition.x;
                mesh.position.z = mesh.userData.originalPosition.z;
            }
            return;
        }

        const next = stepPlayer(
            { x: mesh.position.x, z: mesh.position.z },
            mesh.userData.originalPosition,
            ball,
            player,
            role
        );
        mesh.position.x = next.x;
        mesh.position.z = next.z;
    });
}

function maybeScore() {
    const near = playersNearBall(9);
    const ball = { x: ballMesh.position.x, z: ballMesh.position.z };
    const homeAttackers = near.filter((p) => p.team === 'home' && p.position !== 'GK');
    const awayAttackers = near.filter((p) => p.team === 'away' && p.position !== 'GK');
    const homeDefenders = near.filter((p) =>
        p.team === 'home' && ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(p.position)
    );
    const awayDefenders = near.filter((p) =>
        p.team === 'away' && ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(p.position)
    );

    const probs = goalProbability({
        homeAttackers,
        awayAttackers,
        homeDefenders,
        awayDefenders,
    });
    const side = resolveGoal(probs);
    if (!side) return;
    if (!validateGoalSide(side, near, ball)) {
        document.getElementById('match-status').textContent = '越位，进攻无效';
        return;
    }
    simulateGoal(side);
}

function simulateGoal(side) {
    const isHomeGoal = side === 'home';

    if (isHomeGoal) {
        gameState.homeScore++;
        document.getElementById('home-score').textContent = gameState.homeScore;
    } else {
        gameState.awayScore++;
        document.getElementById('away-score').textContent = gameState.awayScore;
    }

    createPlayersOnField();
    resetKickoff(isHomeGoal ? '主队进球！开球' : '客队进球！开球');

    document.getElementById('score-display').style.color = isHomeGoal ? '#4a9eff' : '#ff6b6b';
    setTimeout(() => {
        document.getElementById('score-display').style.color = '#fff';
    }, 500);
}

function showSubstitutionModal() {
    if (gameState.substitutionsRemaining <= 0) {
        alert('换人次数已用完');
        return;
    }

    document.getElementById('sub-remaining').textContent = gameState.substitutionsRemaining;

    const onField = document.getElementById('on-field');
    onField.innerHTML = '';
    gameState.startingEleven.forEach((player) => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `<span>${player.name}</span><span>${player.position}</span>`;
        item.addEventListener('click', () => selectPlayerOut(player, item));
        onField.appendChild(item);
    });

    const onBench = document.getElementById('on-bench');
    onBench.innerHTML = '';
    gameState.bench.forEach((player) => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `<span>${player.name}</span><span>${player.position}</span>`;
        item.addEventListener('click', () => selectPlayerIn(player, item));
        onBench.appendChild(item);
    });

    document.getElementById('substitution-modal').classList.remove('hidden');
}

function selectPlayerOut(player, item) {
    document.querySelectorAll('#on-field .player-item').forEach((i) => i.classList.remove('selected'));
    item.classList.add('selected');
    gameState.selectedPlayerOut = player;
}

function selectPlayerIn(player, item) {
    document.querySelectorAll('#on-bench .player-item').forEach((i) => i.classList.remove('selected'));
    item.classList.add('selected');
    gameState.selectedPlayerIn = player;
}

function confirmSubstitution() {
    if (!gameState.selectedPlayerOut || !gameState.selectedPlayerIn) {
        alert('请选择要换下的球员和换上的球员');
        return;
    }

    const outIndex = gameState.startingEleven.findIndex((p) => p.id === gameState.selectedPlayerOut.id);
    gameState.startingEleven[outIndex] = gameState.selectedPlayerIn;

    const inIndex = gameState.bench.findIndex((p) => p.id === gameState.selectedPlayerIn.id);
    gameState.bench[inIndex] = gameState.selectedPlayerOut;

    gameState.substitutionsRemaining--;

    createPlayersOnField();

    gameState.selectedPlayerOut = null;
    gameState.selectedPlayerIn = null;

    hideModal('substitution-modal');

    if (gameState.matchStatus !== 'half_time' && gameState.matchStatus !== 'finished') {
        gameState.isPaused = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initializeUI();
});
