'use strict';

// key used to save match state across page reloads
const STATE_KEY = 'cricketmaster_state_v3';

let match = null;
let editingBallIdx = null;

// default player names so the form isn't empty on load
const DEFAULT_PLAYERS = [
  'Player 1','Player 2','Player 3','Player 4','Player 5','Player 6',
  'Player 7','Player 8','Player 9','Player 10','Player 11'
];

let setupState = {
  format: 'T20', totalOvers: 20,
  playersPerSide: 11,
  team1: { name: '', players: [] },
  team2: { name: '', players: [] },
  tossWinner: null, tossDecision: null,
  extrasCost: 1,
  penalty5Enabled: false,
  maxBowlerOvers: 0,
};

function saveToStorage() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(match)); } catch(e) {}
}
function loadFromStorage() {
  try {
    const s = localStorage.getItem(STATE_KEY);
    if (s) match = JSON.parse(s);
  } catch(e) { match = null; }
}

// restore whatever screen the user was on when they last left
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  if (match && match.phase === 'live') {
    showScreen('screen-score');
    renderLiveScore();
    const i = inn();
    if (i.currentBowlerIdx === null) openNewBowlerModal(i.legalBalls === 0);
  } else if (match && match.phase === 'scorecard') {
    showScreen('screen-scorecard');
    buildScorecard();
  } else {
    showScreen('screen-setup');
    initSquadGrids();
  }
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// wire up all the setup form listeners
function initSquadGrids() {
  buildSquadGrid(1);
  buildSquadGrid(2);

  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setupState.format = btn.dataset.format;
      const og = document.getElementById('oversGroup');
      if (setupState.format === 'Test') {
        og.style.display = 'none'; setupState.totalOvers = 0;
      } else {
        og.style.display = '';
        setupState.totalOvers = setupState.format === 'T20' ? 20 : 50;
        document.getElementById('totalOvers').value = setupState.totalOvers;
      }
    });
  });
  document.getElementById('totalOvers').addEventListener('input', function() {
    setupState.totalOvers = parseInt(this.value) || 20;
  });
  document.getElementById('team1Name').addEventListener('input', function() {
    document.getElementById('squad1Label').textContent = this.value || 'Team 1';
  });
  document.getElementById('team2Name').addEventListener('input', function() {
    document.getElementById('squad2Label').textContent = this.value || 'Team 2';
  });

  // players per side — rebuild grids when the number changes
  document.getElementById('playersPerSide').addEventListener('input', function() {
    const v = Math.max(1, parseInt(this.value) || 1);
    setupState.playersPerSide = v;
    const hint = v === 11 ? 'Standard 11-a-side'
                : v  < 11 ? `${v}-a-side (custom)`
                : `${v}-a-side`;
    document.getElementById('playersPerSideHint').textContent = hint;
    const squadHint = `(min ${v})`;
    document.getElementById('squad1Hint').textContent = squadHint;
    document.getElementById('squad2Hint').textContent = squadHint;
    buildSquadGrid(1);
    buildSquadGrid(2);
    updateXICount(1); updateXICount(2);
  });

  // extras penalty selector (+1 or +2 per wide/no-ball)
  document.querySelectorAll('#extrasSelector .rule-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#extrasSelector .rule-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setupState.extrasCost = parseInt(btn.dataset.extras);
      document.getElementById('wideCostLabel').textContent   = `+${setupState.extrasCost}`;
      document.getElementById('noballCostLabel').textContent = `+${setupState.extrasCost}`;
    });
  });

  document.getElementById('penalty5Toggle').addEventListener('change', function() {
    setupState.penalty5Enabled = this.checked;
    document.getElementById('penalty5Label').textContent = this.checked ? 'Enabled' : 'Disabled';
  });

  document.getElementById('maxBowlerOvers').addEventListener('input', function() {
    const v = parseInt(this.value) || 0;
    setupState.maxBowlerOvers = v;
    document.getElementById('maxBowlerOversHint').textContent = v > 0 ? `Max ${v} overs` : 'Unlimited';
  });
}

function buildSquadGrid(t) {
  const n    = setupState.playersPerSide || 11;
  const grid = document.getElementById(`squad${t}Grid`);
  grid.innerHTML = '';
  // fill with as many default rows as needed
  for (let i = 0; i < n; i++) {
    addPlayerRowToGrid(t, DEFAULT_PLAYERS[i] || '', i);
  }
}
function addPlayerRow(t) {
  const grid = document.getElementById(`squad${t}Grid`);
  addPlayerRowToGrid(t, '', grid.children.length);
}
function addPlayerRowToGrid(t, name, idx) {
  const grid = document.getElementById(`squad${t}Grid`);
  const row = document.createElement('div');
  row.className = 'player-row';
  row.innerHTML = `
    <div class="player-num">${idx + 1}</div>
    <input type="text" class="player-name-input" placeholder="Player name" value="${name}" id="t${t}p${idx}" />
    <select class="player-role-select" id="t${t}role${idx}">
      <option value="bat">Batsman</option>
      <option value="bowl">Bowler</option>
      <option value="allr">All-Rounder</option>
      <option value="wk">Wicket-Keeper</option>
    </select>
    <button class="role-icon-btn" title="Captain" id="t${t}cap${idx}" onclick="toggleCaptain(${t},${idx})">C</button>
    <button class="role-icon-btn" title="Keeper" id="t${t}wk${idx}" onclick="toggleKeeper(${t},${idx})">🧤</button>
  `;
  grid.appendChild(row);
}

// only one captain and keeper allowed per team
let captains = {1: null, 2: null};
let keepers  = {1: null, 2: null};

function toggleCaptain(t, idx) {
  if (captains[t] !== null) {
    const p = document.getElementById(`t${t}cap${captains[t]}`);
    if (p) p.classList.remove('captain-active');
  }
  captains[t] = captains[t] === idx ? null : idx;
  if (captains[t] !== null) document.getElementById(`t${t}cap${idx}`).classList.add('captain-active');
}
function toggleKeeper(t, idx) {
  if (keepers[t] !== null) {
    const p = document.getElementById(`t${t}wk${keepers[t]}`);
    if (p) p.classList.remove('keeper-active');
  }
  keepers[t] = keepers[t] === idx ? null : idx;
  if (keepers[t] !== null) document.getElementById(`t${t}wk${idx}`).classList.add('keeper-active');
}

function collectSquad(t) {
  const rows = document.getElementById(`squad${t}Grid`).querySelectorAll('.player-row');
  const players = [];
  rows.forEach((row, i) => {
    const name = row.querySelector('.player-name-input')?.value.trim();
    const role = row.querySelector('.player-role-select')?.value || 'bat';
    if (name) players.push({ id: i, name, role, isCaptain: captains[t] === i, isKeeper: keepers[t] === i });
  });
  return players;
}

function proceedToToss() {
  setupState.team1.name = document.getElementById('team1Name').value.trim() || 'Team 1';
  setupState.team2.name = document.getElementById('team2Name').value.trim() || 'Team 2';
  setupState.totalOvers = parseInt(document.getElementById('totalOvers').value) || 20;
  setupState.playersPerSide  = Math.max(1, parseInt(document.getElementById('playersPerSide').value) || 11);
  setupState.extrasCost      = parseInt(document.querySelector('#extrasSelector .rule-btn.active')?.dataset.extras) || 1;
  setupState.penalty5Enabled = document.getElementById('penalty5Toggle').checked;
  setupState.maxBowlerOvers  = parseInt(document.getElementById('maxBowlerOvers').value) || 0;
  setupState.team1.players = collectSquad(1);
  setupState.team2.players = collectSquad(2);
  const n = setupState.playersPerSide;
  if (setupState.team1.players.length < n || setupState.team2.players.length < n) {
    alert(`Each team needs at least ${n} named players.`); return;
  }
  showScreen('screen-toss');
}
function goToSetup() { showScreen('screen-setup'); }

// toss screen
let coinFlipped = false;

function flipCoin() {
  if (coinFlipped) return;
  const inner = document.getElementById('coinInner');
  inner.classList.add('flipping');
  setTimeout(() => {
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const winner = Math.random() < 0.5 ? setupState.team1.name : setupState.team2.name;
    setupState.tossWinner = winner;
    document.getElementById('tossResultText').textContent = `${winner} won the toss!`;
    document.getElementById('tossHint').textContent = result === 'heads' ? '🪙 Heads!' : '🪙 Tails!';
    document.getElementById('tossResultSection').style.display = 'block';
    coinFlipped = true;
  }, 1200);
}

function setTossDecision(dec) {
  setupState.tossDecision = dec;
  document.getElementById('electBat').classList.toggle('selected', dec === 'bat');
  document.getElementById('electBowl').classList.toggle('selected', dec === 'bowl');
  document.getElementById('btnProceedToXI').style.display = 'block';
}
function goToToss() { showScreen('screen-toss'); }

function proceedToPlayingXI() {
  if (!setupState.tossDecision) { alert('Please choose Bat or Bowl.'); return; }
  buildXISelectors();
  showScreen('screen-xi');
}

// playing XI selection
let xiSelections = {1: new Set(), 2: new Set()};

function buildXISelectors() {
  document.getElementById('xi1Label').textContent = setupState.team1.name;
  document.getElementById('xi2Label').textContent = setupState.team2.name;
  buildXIList(1, setupState.team1.players);
  buildXIList(2, setupState.team2.players);
  updateXICount(1); updateXICount(2);
}

function buildXIList(t, players) {
  const list = document.getElementById(`xi${t}List`);
  list.innerHTML = '';
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'xi-player-item';
    item.id = `xi${t}_${p.id}`;
    const badges = [];
    if (p.isCaptain) badges.push('<span class="xi-badge c">C</span>');
    if (p.isKeeper)  badges.push('<span class="xi-badge wk">WK</span>');
    if (p.role === 'bat')  badges.push('<span class="xi-badge bat">BAT</span>');
    if (p.role === 'bowl') badges.push('<span class="xi-badge bowl">BOWL</span>');
    if (p.role === 'allr') badges.push('<span class="xi-badge allr">AR</span>');
    item.innerHTML = `
      <div class="xi-check">✓</div>
      <div class="xi-player-name">${p.name}</div>
      <div class="xi-role-badges">${badges.join('')}</div>`;
    item.addEventListener('click', () => toggleXI(t, p.id, item));
    list.appendChild(item);
  });
}

function toggleXI(t, id, el) {
  const n = setupState.playersPerSide || 11;
  if (xiSelections[t].has(id)) {
    xiSelections[t].delete(id);
    el.classList.remove('selected');
  } else {
    if (xiSelections[t].size >= n) { alert(`Only ${n} players allowed per side.`); return; }
    xiSelections[t].add(id);
    el.classList.add('selected');
  }
  updateXICount(t);
}

function updateXICount(t) {
  const n   = setupState.playersPerSide || 11;
  const cnt = xiSelections[t].size;
  let countEl = document.getElementById(`xi${t}Count`);
  if (!countEl) {
    countEl = document.createElement('div');
    countEl.id = `xi${t}Count`;
    countEl.className = 'xi-count';
    document.getElementById(`xi${t}List`).parentNode.appendChild(countEl);
  }
  countEl.textContent = `${cnt}/${n} selected`;
  countEl.style.color = cnt === n ? 'var(--green)' : 'var(--text-muted)';
}

function startMatch() {
  const n = setupState.playersPerSide || 11;
  if (xiSelections[1].size < n || xiSelections[2].size < n) {
    alert(`Select exactly ${n} players for each team.`); return;
  }
  const xi1 = setupState.team1.players.filter(p => xiSelections[1].has(p.id));
  const xi2 = setupState.team2.players.filter(p => xiSelections[2].has(p.id));

  let battingTeam, fieldingTeam, battingXI, fieldingXI;
  const tossWonByTeam1 = setupState.tossWinner === setupState.team1.name;
  const tossWinnerBats = setupState.tossDecision === 'bat';

  // figure out who bats first based on toss result
  if ((tossWonByTeam1 && tossWinnerBats) || (!tossWonByTeam1 && !tossWinnerBats)) {
    battingTeam = setupState.team1.name; fieldingTeam = setupState.team2.name;
    battingXI = xi1; fieldingXI = xi2;
  } else {
    battingTeam = setupState.team2.name; fieldingTeam = setupState.team1.name;
    battingXI = xi2; fieldingXI = xi1;
  }

  match = {
    phase: 'live',
    format: setupState.format,
    totalOvers: setupState.totalOvers,
    playersPerSide: setupState.playersPerSide,
    team1: setupState.team1.name,
    team2: setupState.team2.name,
    tossWinner: setupState.tossWinner,
    tossDecision: setupState.tossDecision,
    extrasCost:      setupState.extrasCost,
    penalty5Enabled: setupState.penalty5Enabled,
    maxBowlerOvers:  setupState.maxBowlerOvers,
    innings: [ createInnings(1, battingTeam, fieldingTeam, battingXI, fieldingXI) ],
    currentInnings: 0,
    result: null,
  };

  saveToStorage();
  showScreen('screen-score');
  openNewBowlerModal(true);
}

// builds a fresh innings object with all stats zeroed out
function createInnings(num, batting, fielding, battingXI, fieldingXI) {
  const n = match?.playersPerSide || battingXI.length;
  const batsmen = battingXI.map((p, i) => ({
    id: i, name: p.name, role: p.role,
    isCaptain: p.isCaptain, isKeeper: p.isKeeper,
    runs: 0, balls: 0, fours: 0, sixes: 0,
    dismissed: false, dismissalInfo: '', dnb: i >= 2,
  }));
  const bowlers = fieldingXI.map((p, i) => ({
    id: i, name: p.name, role: p.role,
    balls: 0, overs: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0,
  }));

  const state = {
    num, batting, fielding, battingXI, fieldingXI,
    batsmen, bowlers,
    runs: 0, wickets: 0,
    extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
    balls: 0, legalBalls: 0,
    currentOver: 0, currentBallInOver: 0,
    strikerIdx: 0, nonStrikerIdx: 1, nextBatsmanIdx: 2,
    currentBowlerIdx: null, lastBowlerIdx: null,
    deliveries: [],
    fowList: [],
    overLog: [],
    target: null,
  };

  // snapshot of the clean starting state — used by replay-based undo
  state.initialState = JSON.parse(JSON.stringify({ ...state, deliveries: [], initialState: null }));
  return state;
}

// quick accessors
function inn()        { return match.innings[match.currentInnings]; }
function striker()    { return inn().batsmen[inn().strikerIdx]; }
function nonStriker() { return inn().batsmen[inn().nonStrikerIdx]; }

function oversStr(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
function calcCRR(i) {
  return i.legalBalls === 0 ? '0.00' : (i.runs / i.legalBalls * 6).toFixed(2);
}
function calcRRR(i) {
  if (!i.target) return null;
  const ballsLeft = match.totalOvers * 6 - i.legalBalls;
  if (ballsLeft <= 0) return null;
  const need = i.target - i.runs;
  if (need <= 0) return null;
  return (need / ballsLeft * 6).toFixed(2);
}

// normal run (dot / 1 / 2 / 3 / 4 / 6)
function submitBall(runs) {
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const d = mkDelivery(runs, 0, null);
  pushAndApply(d);
}

// legacy entry point — now just routes to the sub-panels
function submitExtra(type) {
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  if (type === 'wide')   { openWidePanel();   return; }
  if (type === 'noball') { openNoBallPanel(); return; }
}

// sub-panel openers
function openWidePanel()      { closeSubPanels(); document.getElementById('widePanel').style.display      = 'block'; }
function openNoBallPanel()    { closeSubPanels(); document.getElementById('noBallPanel').style.display    = 'block'; }
function openOverthrowPanel() { closeSubPanels(); document.getElementById('overthrowPanel').style.display = 'block'; }

// wide: penalty + any runs scored (e.g. bye off a wide)
function submitWide(extraRuns) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const cost = match.extrasCost || 1;
  const d = mkDelivery(0, cost + extraRuns, 'wide', false);
  pushAndApply(d);
}

// no ball: batsman can score runs off it; penalty goes to extras
function submitNoBall(batsmanRuns) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const cost = match.extrasCost || 1;
  const d = mkDelivery(batsmanRuns, cost, 'noball', false);
  pushAndApply(d);
}

// overthrow: counts as a legal delivery, runs go to the batsman
function submitOverthrow(runs) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const d = mkDelivery(runs, 0, null, true);
  d.isOverthrow = true;
  pushAndApply(d);
}

function submitBye(runs) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const d = mkDelivery(0, runs, 'bye', true);
  pushAndApply(d);
}

function submitLegBye(runs) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const d = mkDelivery(0, runs, 'legbye', true);
  pushAndApply(d);
}

function openPenaltyPanel() {
  closeSubPanels();
  document.getElementById('penaltyPanel').style.display = 'block';
}

function submitPenalty(beneficiary) {
  closeSubPanels();
  const i = inn();
  if (i.currentBowlerIdx === null) { openNewBowlerModal(i.legalBalls === 0); return; }
  const d = mkDelivery(0, 0, null, true);
  d.penalty = { beneficiary };
  pushAndApply(d);
}

// build a delivery object — never store snapshots inside it
function mkDelivery(runs, extras, extraType, legal) {
  const i = inn();
  if (legal === undefined) legal = (extraType === null);
  if (extraType === 'bye' || extraType === 'legbye') legal = true;
  return {
    overNum:    i.currentOver,
    ballNum:    i.currentBallInOver,
    legal,
    runs,
    extras,
    extraType,
    batsmanIdx: i.strikerIdx,
    bowlerIdx:  i.currentBowlerIdx,
    wicket:     null,
  };
}

// add delivery to log, apply it, then check if innings/match ended
function pushAndApply(d) {
  const i = inn();
  i.deliveries.push(d);
  applyDelivery(d, i);
  saveToStorage();
  renderLiveScore();
  checkInningsEnd();
  // if a wicket was just taken, prompt for next batsman
  if (i._pendingNextBatsman) {
    i._pendingNextBatsman = false;
    openNextBatsmanModal();
  }
}

// the core engine — mutates innings state based on one delivery
function applyDelivery(d, i) {
  const bwl = i.bowlers[d.bowlerIdx];
  const bat  = i.batsmen[d.batsmanIdx];
  bat.dnb = false;

  const totalRuns = d.runs + d.extras;
  i.runs += totalRuns;

  switch (d.extraType) {
    case 'wide':
      bwl.runs += totalRuns; bwl.wides++;
      i.extras.wides += d.extras;
      break;
    case 'noball':
      bwl.runs += totalRuns; bwl.noballs++;
      i.extras.noballs += d.extras;
      bat.runs += d.runs; bat.balls++;
      break;
    case 'bye':
      i.extras.byes += d.extras;
      bwl.balls++; bat.balls++;
      break;
    case 'legbye':
      i.extras.legbyes += d.extras;
      bwl.balls++; bat.balls++;
      break;
    default:
      if (d.penalty) {
        // 5-run penalty: awarded to one team and counts as a legal ball
        const penRuns = 5;
        if (d.penalty.beneficiary === 'batting') {
          i.runs += penRuns;
          i.extras.penalty = (i.extras.penalty || 0) + penRuns;
          i.extras.penaltyBatting = (i.extras.penaltyBatting || 0) + penRuns;
        } else {
          i.runs -= penRuns;
          i.extras.penalty = (i.extras.penalty || 0) - penRuns;
          i.extras.penaltyFielding = (i.extras.penaltyFielding || 0) + penRuns;
        }
        bwl.balls++; bat.balls++;
      } else {
        bat.runs += d.runs; bat.balls++;
        if (d.runs === 4) bat.fours++;
        if (d.runs === 6) bat.sixes++;
        bwl.runs += d.runs; bwl.balls++;
      }
  }

  // handle wicket — mark batsman dismissed and set flag for next batsman prompt
  if (d.wicket) {
    i.wickets++;
    const outBat = i.batsmen[d.batsmanIdx];
    outBat.dismissed = true;
    outBat.dismissalInfo = d.wicket.dismissalText || '';
    i.fowList.push({
      wicket: i.wickets, runs: i.runs,
      over: oversStr(i.legalBalls + (d.legal ? 1 : 0)),
      batsmanName: outBat.name,
    });
    if (!d.wicket.runOutNonStriker) {
      i._wicketOutIdx = i.strikerIdx;
      i._wicketSide = 'striker';
    } else {
      // non-striker was run out
      i._wicketOutIdx = i.nonStrikerIdx;
      i._wicketSide = 'nonstriker';
    }
    // mark pending if there are still batsmen left to come in
    i._pendingNextBatsman = (i.nextBatsmanIdx < i.batsmen.length && i.wickets < (match.playersPerSide || 11) - 1);
  }

  // count legal balls and manage over transitions
  if (d.legal) {
    i.legalBalls++;
    i.currentBallInOver++;

    let overJustEnded = false;
    if (i.currentBallInOver >= 6) {
      overJustEnded = true;
      // check for maiden before resetting the over
      const overRuns = i.deliveries
        .filter(x => x.overNum === d.overNum && x.legal)
        .reduce((s, x) => s + x.runs + x.extras, 0);
      if (overRuns === 0) bwl.maidens++;
      bwl.overs++;
      i.overLog.push({ over: i.currentOver, bowlerIdx: d.bowlerIdx });
      i.lastBowlerIdx = d.bowlerIdx;
      i.currentOver++;
      i.currentBallInOver = 0;
      i.currentBowlerIdx = null;
      rotateStrike(i);
      i._overJustEnded = true;
    }

    // rotate strike on odd runs (but not if the over just ended — already done above)
    if (!overJustEnded && !d.wicket) {
      const runForRotation = (d.extraType === 'bye' || d.extraType === 'legbye')
        ? d.extras : d.runs;
      if (runForRotation % 2 === 1) rotateStrike(i);
    }
  }
}

function rotateStrike(i) {
  const tmp = i.strikerIdx;
  i.strikerIdx = i.nonStrikerIdx;
  i.nonStrikerIdx = tmp;
}

// undo: remove last ball and replay innings from scratch
function undoLastBall() {
  const i = inn();
  if (!i.deliveries.length) return;
  i.deliveries.pop();
  replayInnings(match.currentInnings);
  saveToStorage();
  renderLiveScore();
  const undoBtn = document.getElementById('btnUndoBall');
  if (undoBtn) undoBtn.disabled = inn().deliveries.length === 0;
}

// replay all deliveries from the clean initial state — safe, no recursion
function replayInnings(innIdx) {
  const cur = match.innings[innIdx];
  const saved = cur.deliveries.slice();
  const init  = JSON.parse(JSON.stringify(cur.initialState));
  init.initialState = cur.initialState;
  init.deliveries = [];
  match.innings[innIdx] = init;
  saved.forEach(d => {
    init.deliveries.push(d);
    applyDelivery(d, init);
  });
}

function checkInningsEnd() {
  const i   = inn();
  const n   = match.playersPerSide || 11;
  // innings ends when overs run out, all wickets fall, or target is chased
  const oversUsed = match.format !== 'Test' && i.legalBalls >= match.totalOvers * 6;
  const allOut    = i.wickets >= n - 1;   // e.g. 10 for 11-a-side
  const chased    = i.target && i.runs >= i.target;

  if (chased) {
    endMatch(`${i.batting} won by ${(n - 1) - i.wickets} wickets`);
    return;
  }
  if (oversUsed || allOut) {
    if (match.currentInnings === 0) {
      showInningsBreak();
    } else {
      const i1 = match.innings[0];
      const i2 = match.innings[1];
      if (i2.runs >= i2.target) {
        endMatch(`${i2.batting} won by ${(n - 1) - i2.wickets} wickets`);
      } else {
        endMatch(`${i1.batting} won by ${(i2.target - 1) - i2.runs} runs`);
      }
    }
    return;
  }
  // ask for new bowler at the start of each over
  if (i.currentBowlerIdx === null && i.currentBallInOver === 0 && i.currentOver > 0) {
    openNewBowlerModal(false);
  }
}

function showInningsBreak() {
  const i = inn();
  document.getElementById('inningsIcon').textContent = '🏏';
  document.getElementById('inningsModalTitle').textContent = 'End of Innings';
  document.getElementById('inningsSummary').innerHTML =
    `<strong>${i.batting}</strong> scored <strong>${i.runs}/${i.wickets}</strong>
     in ${oversStr(i.legalBalls)} overs<br/><br/>
     <strong>${i.fielding}</strong> need <strong>${i.runs + 1} runs</strong> to win`;
  document.getElementById('inningsModal').style.display = 'flex';
}

function startSecondInnings() {
  document.getElementById('inningsModal').style.display = 'none';
  const i1 = match.innings[0];
  const inn2 = createInnings(2, i1.fielding, i1.batting, i1.fieldingXI, i1.battingXI);
  inn2.target = i1.runs + 1;
  match.innings.push(inn2);
  match.currentInnings = 1;
  saveToStorage();
  openNewBowlerModal(true);
  renderLiveScore();
}

function endMatch(result) {
  match.result = result;
  match.phase  = 'scorecard';
  saveToStorage();
  document.getElementById('resultTitle').textContent   = '🏆 Match Result';
  document.getElementById('resultSummary').innerHTML   =
    `<strong>${result}</strong><br/><br/>` +
    match.innings.map(i => `<div>${i.batting}: ${i.runs}/${i.wickets} (${oversStr(i.legalBalls)} ov)</div>`).join('');
  document.getElementById('resultModal').style.display = 'flex';
}

// updates every visible stat on the live scoring screen
function renderLiveScore() {
  const i   = inn();
  const s   = i.batsmen[i.strikerIdx];
  const ns  = i.batsmen[i.nonStrikerIdx];
  const bwl = i.currentBowlerIdx !== null ? i.bowlers[i.currentBowlerIdx] : null;

  document.getElementById('scoreMatchInfo').textContent =
    `${match.team1} vs ${match.team2} · ${match.format}` +
    (match.format !== 'Test' ? ` · ${match.totalOvers} ov` : '');

  document.getElementById('battingTeamName').textContent = i.batting + (i.target ? ` (Target: ${i.target})` : '');
  document.getElementById('mainScore').textContent       = `${i.runs}/${i.wickets}`;

  const extTot = i.extras.wides + i.extras.noballs + i.extras.byes + i.extras.legbyes;
  document.getElementById('scoreMeta').textContent =
    `${oversStr(i.legalBalls)} ov${match.format !== 'Test' ? ' of ' + match.totalOvers : ''} · Extras: ${extTot}`;

  document.getElementById('crrVal').textContent = calcCRR(i);
  const rrr = calcRRR(i);
  const rrrPill = document.getElementById('rrrPill');
  if (rrr) { rrrPill.style.display = 'flex'; document.getElementById('rrrVal').textContent = rrr; }
  else      { rrrPill.style.display = 'none'; }

  renderOverDots(i);

  // update both batsmen rows
  const setStat = (prefix, b) => {
    document.getElementById(`${prefix}Name`).textContent  = b ? b.name : '—';
    document.getElementById(`${prefix}Runs`).textContent  = b ? b.runs : 0;
    document.getElementById(`${prefix}Balls`).textContent = b ? b.balls : 0;
    document.getElementById(`${prefix}SR`).textContent    = b && b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : '0.0';
  };
  setStat('striker', s);
  setStat('nonStriker', ns);

  // bowler stats
  if (bwl) {
    document.getElementById('bowlerName').textContent    = bwl.name;
    document.getElementById('bowlerOvers').textContent   = oversStr(bwl.balls);
    document.getElementById('bowlerMaidens').textContent = bwl.maidens;
    document.getElementById('bowlerRuns').textContent    = bwl.runs;
    document.getElementById('bowlerWickets').textContent = bwl.wickets;
    document.getElementById('bowlerEco').textContent     = bwl.balls > 0 ? (bwl.runs / bwl.balls * 6).toFixed(2) : '0.00';
  } else {
    document.getElementById('bowlerName').textContent = i.currentBallInOver === 0 && i.currentOver > 0 ? 'Select bowler →' : '—';
  }

  renderBallLog(i);
  document.getElementById('logCount').textContent = `${i.deliveries.length} balls`;

  // grey out delete button when there's nothing to undo
  const undoBtn = document.getElementById('btnUndoBall');
  if (undoBtn) undoBtn.disabled = i.deliveries.length === 0;

  // keep the +1/+2 label in sync with the configured extras cost
  const cost = match.extrasCost || 1;
  const wl = document.getElementById('wideCostLabel');
  const nl = document.getElementById('noballCostLabel');
  if (wl) wl.textContent = `+${cost}`;
  if (nl) nl.textContent = `+${cost}`;

  const penBtn = document.getElementById('btnPenalty5');
  if (penBtn) penBtn.style.display = match.penalty5Enabled ? 'block' : 'none';
}

// renders the coloured ball dots for the current over
function renderOverDots(i) {
  const container = document.getElementById('overDots');
  container.innerHTML = '';
  const cur = i.currentOver;
  i.deliveries.filter(d => d.overNum === cur).forEach(d => {
    const dot = document.createElement('div');
    dot.className = `over-dot ${getDotClass(d)}`;
    dot.textContent = getDotLabel(d);
    container.appendChild(dot);
  });
}

function getDotClass(d) {
  if (d.wicket)               return 'dot-W';
  if (d.extraType==='wide')   return 'dot-wd';
  if (d.extraType==='noball') return 'dot-nb';
  if (d.extraType==='bye')    return 'dot-bye';
  if (d.extraType==='legbye') return 'dot-lb';
  if (d.isOverthrow)          return 'dot-overthrow';
  if (d.runs === 6)           return 'dot-6';
  if (d.runs === 4)           return 'dot-4';
  if (d.penalty)              return 'dot-penalty';
  return `dot-${d.runs}`;
}
function getDotLabel(d) {
  if (d.wicket)               return 'W';
  if (d.extraType==='wide')   return d.extras > 1 ? `Wd+${d.extras - (match.extrasCost||1)}` : 'Wd';
  if (d.extraType==='noball') return d.runs > 0 ? `Nb+${d.runs}` : 'Nb';
  if (d.extraType==='bye')    return `${d.extras}b`;
  if (d.extraType==='legbye') return `${d.extras}lb`;
  if (d.penalty)              return 'P5';
  if (d.isOverthrow)          return `OT${d.runs}`;
  return d.runs;
}

// renders the scrollable ball-by-ball list (newest on top)
function renderBallLog(i) {
  const log = document.getElementById('ballLog');
  log.innerHTML = '';
  [...i.deliveries].reverse().forEach((d, revIdx) => {
    const realIdx = i.deliveries.length - 1 - revIdx;
    const bat = i.batsmen[d.batsmanIdx];
    const bwl = i.bowlers[d.bowlerIdx];
    const item = document.createElement('div');
    item.className = 'ball-log-item';
    item.onclick   = () => openEditBall(realIdx);

    let desc = `<strong>${bat?.name || '?'}</strong> off <strong>${bwl?.name || '?'}</strong>`;
    const cost = match?.extrasCost || 1;
    if (d.wicket)            desc += ` — <span style="color:var(--red)">OUT ${d.wicket.type}</span>`;
    else if (d.penalty)      desc += ` — <span style="color:var(--gold)">5-Run Penalty (${d.penalty.beneficiary} team)</span>`;
    else if (d.isOverthrow)  desc += ` — <span style="color:var(--amber)">Overthrow (${d.runs} runs)</span>`;
    else if (d.extraType==='wide')   desc += ` — Wide (+${d.extras})`;
    else if (d.extraType==='noball') desc += ` — No Ball${d.runs ? ` +${d.runs}b` : ''} (+${cost} penalty)`;
    else if (d.extraType==='bye')    desc += ` — ${d.extras} Bye${d.extras!==1?'s':''}`;
    else if (d.extraType==='legbye') desc += ` — ${d.extras} Leg Bye${d.extras!==1?'s':''}`;
    else if (d.runs === 0)           desc += ' — Dot ball';
    else                             desc += ` — ${d.runs} run${d.runs!==1?'s':''}`;

    item.innerHTML = `
      <div class="ball-num">${d.overNum}.${d.ballNum + 1}</div>
      <div class="ball-badge over-dot ${getDotClass(d)}">${getDotLabel(d)}</div>
      <div class="ball-desc">${desc}</div>
      <div class="ball-edit-icon">✏️</div>
    `;
    log.appendChild(item);
  });
}

// next batsman modal — opens right after a wicket falls
function openNextBatsmanModal() {
  const i   = inn();
  const n   = match.playersPerSide || 11;
  const outSide   = i._wicketSide || 'striker';
  const nextIdx   = i.nextBatsmanIdx;
  const available = i.batsmen.slice(nextIdx).filter(b => !b.dismissed);

  if (!available.length || i.wickets >= n - 1) return;

  const list = document.getElementById('nextBatsmanList');
  list.innerHTML = '';
  available.forEach(b => {
    const item = document.createElement('div');
    item.className = 'player-select-item';
    item.innerHTML = `
      <span class="psi-num">${i.batsmen.indexOf(b) + 1}</span>
      <span>${b.name}</span>
      <small>${b.isCaptain ? 'C · ' : ''}${b.isKeeper ? 'WK · ' : ''}${b.role}</small>`;
    item.onclick = () => selectNextBatsman(i.batsmen.indexOf(b), outSide);
    list.appendChild(item);
  });

  document.getElementById('nextBatsmanModal').style.display = 'flex';
}

function selectNextBatsman(batsmanIdx, side) {
  const i = inn();
  i.batsmen[batsmanIdx].dnb = false;
  if (side === 'striker') {
    i.strikerIdx = batsmanIdx;
  } else {
    i.nonStrikerIdx = batsmanIdx;
  }
  // move the pointer forward so this player isn't offered again
  i.nextBatsmanIdx = Math.max(i.nextBatsmanIdx, batsmanIdx + 1);
  document.getElementById('nextBatsmanModal').style.display = 'none';
  saveToStorage();
  renderLiveScore();
}

// wicket modal
let wicketState = { type: 'Bowled', fielder: '', runOutNonStriker: false };

function openWicketPanel() {
  wicketState = { type: 'Bowled', fielder: '', runOutNonStriker: false };
  document.querySelectorAll('.dismissal-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-type="Bowled"]').classList.add('active');
  updateWicketModal();
  document.getElementById('wicketModal').style.display = 'flex';
}

function selectDismissal(type) {
  wicketState.type = type;
  document.querySelectorAll('.dismissal-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-type="${type}"]`).classList.add('active');
  updateWicketModal();
}

// show/hide the fielder dropdown depending on dismissal type
function updateWicketModal() {
  const i = inn();
  const fielderSec = document.getElementById('fielderSection');
  const runOutSec  = document.getElementById('runOutStrikerSection');
  const fielderSel = document.getElementById('fielderSelect');
  const fielderLbl = document.getElementById('fielderLabel');
  fielderSec.style.display = 'none';
  runOutSec.style.display  = 'none';

  if (['Caught','Stumped'].includes(wicketState.type)) {
    fielderSec.style.display = 'block';
    fielderLbl.textContent   = wicketState.type === 'Caught' ? 'Caught by' : 'Stumped by';
    populateFielderSelect(fielderSel, i);
  }
  if (wicketState.type === 'Run Out') {
    runOutSec.style.display  = 'block';
    fielderSec.style.display = 'block';
    fielderLbl.textContent   = 'Fielder (optional)';
    populateFielderSelect(fielderSel, i);
  }
}

function populateFielderSelect(sel, i) {
  sel.innerHTML = '<option value="">— Select —</option>';
  i.bowlers.forEach(b => {
    const o = document.createElement('option');
    o.value = b.name; o.textContent = b.name;
    sel.appendChild(o);
  });
}

function setRunOutPlayer(who) {
  wicketState.runOutNonStriker = who === 'nonstriker';
  document.getElementById('ROStriker').classList.toggle('active',    who === 'striker');
  document.getElementById('RONonStriker').classList.toggle('active', who === 'nonstriker');
}

function confirmWicket() {
  const i = inn();
  const fielder = document.getElementById('fielderSelect').value;
  wicketState.fielder = fielder;

  // build the short scorecard dismissal string (e.g. "c Smith b Jones")
  const bwlName = (i.currentBowlerIdx !== null ? i.bowlers[i.currentBowlerIdx].name : '');
  let dText = '';
  switch (wicketState.type) {
    case 'Bowled':      dText = `b ${bwlName}`; break;
    case 'Caught':      dText = `c ${fielder} b ${bwlName}`; break;
    case 'LBW':         dText = `lbw b ${bwlName}`; break;
    case 'Run Out':     dText = `run out (${fielder || 'sub'})`; break;
    case 'Stumped':     dText = `st ${fielder} b ${bwlName}`; break;
    case 'Hit Wicket':  dText = `hit wkt b ${bwlName}`; break;
    default:            dText = wicketState.type;
  }

  const d = mkDelivery(0, 0, null, true);
  d.wicket = { type: wicketState.type, fielder, runOutNonStriker: wicketState.runOutNonStriker, dismissalText: dText };

  // run outs and obstructions don't count as bowler wickets
  if (!['Run Out','Obstructing','Handled Ball'].includes(wicketState.type)) {
    if (i.currentBowlerIdx !== null) i.bowlers[i.currentBowlerIdx].wickets++;
  }

  closeWicketModal();
  pushAndApply(d);
}

function closeWicketModal() {
  document.getElementById('wicketModal').style.display = 'none';
}

// bowler selection modal — opens at over start
function openNewBowlerModal(isFirst = false) {
  const i = inn();
  document.getElementById('bowlerModalSub').textContent =
    isFirst ? 'Choose the opening bowler:' : 'Choose bowler for this over:';
  const list = document.getElementById('newBowlerList');
  list.innerHTML = '';
  const maxOv = match.maxBowlerOvers || 0;
  i.bowlers.forEach((b, idx) => {
    if (idx === i.lastBowlerIdx) return; // can't bowl consecutive overs
    if (maxOv > 0 && b.overs >= maxOv) return;
    const item = document.createElement('div');
    item.className = 'player-select-item';
    const eco = b.balls > 0 ? (b.runs / b.balls * 6).toFixed(1) : '—';
    const oversCap = maxOv > 0 ? ` (${b.overs}/${maxOv} ov)` : '';
    item.innerHTML = `
      <span class="psi-num">${idx + 1}</span>
      <span>${b.name}</span>
      <small>${oversStr(b.balls)} ov${oversCap} · ${b.wickets}w · Eco ${eco}</small>`;
    item.onclick = () => selectBowler(idx);
    list.appendChild(item);
  });
  if (list.children.length === 0) {
    list.innerHTML = '<div style="color:var(--red);padding:12px;">⚠️ No eligible bowlers available! All bowlers have reached their maximum overs or bowled the previous over.</div>';
  }
  document.getElementById('newBowlerModal').style.display = 'flex';
}

function selectBowler(idx) {
  inn().currentBowlerIdx = idx;
  closeNewBowlerModal();
  saveToStorage();
  renderLiveScore();
}
function closeNewBowlerModal() {
  document.getElementById('newBowlerModal').style.display = 'none';
}

// edit modal — tap any ball in the log to open this
function openEditBall(idx) {
  editingBallIdx = idx;
  const i = inn();
  const d = i.deliveries[idx];
  document.getElementById('editBallInfo').textContent =
    `Over ${d.overNum}.${d.ballNum + 1} · ${getDotLabel(d)} · Batsman: ${i.batsmen[d.batsmanIdx]?.name}`;
  document.getElementById('editBallModal').style.display = 'flex';
}
function closeEditBallModal() {
  document.getElementById('editBallModal').style.display = 'none';
  editingBallIdx = null;
}
function deleteBall() {
  if (editingBallIdx === null) return;
  const i = inn();
  i.deliveries.splice(editingBallIdx, 1);
  replayInnings(match.currentInnings);
  closeEditBallModal();
  saveToStorage();
  renderLiveScore();
}

// sub-panel helpers
function openByePanel()    { closeSubPanels(); document.getElementById('byePanel').style.display        = 'block'; }
function openLegByePanel() { closeSubPanels(); document.getElementById('legByePanel').style.display     = 'block'; }
function closeSubPanels()  {
  ['byePanel','legByePanel','penaltyPanel','widePanel','noBallPanel','overthrowPanel']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

function showScorecard() {
  buildScorecard();
  showScreen('screen-scorecard');
}
function backToLive() {
  showScreen(match && match.phase === 'live' ? 'screen-score' : 'screen-setup');
}

// builds the full batting + bowling scorecard HTML
function buildScorecard() {
  const body = document.getElementById('scorecardBody');
  body.innerHTML = '';
  if (!match) return;

  match.innings.forEach(i => {
    const sec = document.createElement('div');
    sec.className = 'sc-innings';
    sec.innerHTML = `<div class="sc-innings-title">${i.batting} Innings ${i.num}${i.target ? ' (Target: ' + i.target + ')' : ''}</div>`;

    // batting table
    const bt = document.createElement('table');
    bt.className = 'sc-table';
    bt.innerHTML = `<thead><tr><th>Batsman</th><th>Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>`;
    const tb = document.createElement('tbody');
    i.batsmen.forEach(b => {
      if (b.dnb && !b.dismissed && b.balls === 0) return;
      const tr = document.createElement('tr');
      const sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : '0.0';
      tr.innerHTML = `
        <td><strong>${b.name}</strong>${b.isCaptain ? ' (c)' : ''}${b.isKeeper ? ' (wk)' : ''}</td>
        <td><div class="out-text">${b.dismissed ? b.dismissalInfo : 'not out'}</div></td>
        <td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${sr}</td>`;
      tb.appendChild(tr);
    });
    // players who didn't bat yet
    const dnb = i.batsmen.filter(b => b.dnb && !b.dismissed && b.balls === 0);
    if (dnb.length) {
      const r = document.createElement('tr');
      r.innerHTML = `<td colspan="7" class="dnb">Did not bat: ${dnb.map(b => b.name).join(', ')}</td>`;
      tb.appendChild(r);
    }
    bt.appendChild(tb);
    sec.appendChild(bt);

    const e = i.extras;
    const penaltyBat = e.penaltyBatting || 0;
    const penaltyFld = e.penaltyFielding || 0;
    const penaltyStr = (penaltyBat || penaltyFld)
      ? ` · Penalty: ${penaltyBat > 0 ? `+${penaltyBat} (batting)` : ''} ${penaltyFld > 0 ? `-${penaltyFld} (fielding)` : ''}`.trim()
      : '';
    sec.insertAdjacentHTML('beforeend', `
      <div class="sc-extras">Extras: ${e.wides+e.noballs+e.byes+e.legbyes} (WD ${e.wides} NB ${e.noballs} B ${e.byes} LB ${e.legbyes})${penaltyStr}</div>
      <div class="sc-total"><strong>Total: ${i.runs}/${i.wickets} (${oversStr(i.legalBalls)} Ov)</strong></div>
    `);

    // bowling table
    const bwlT = document.createElement('table');
    bwlT.className = 'sc-table sc-bowler-table';
    bwlT.innerHTML = `<thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th><th>WD</th><th>NB</th></tr></thead>`;
    const bb = document.createElement('tbody');
    i.bowlers.forEach(b => {
      if (b.balls === 0 && !b.wides && !b.noballs) return;
      const tr = document.createElement('tr');
      const eco = b.balls > 0 ? (b.runs / b.balls * 6).toFixed(2) : '0.00';
      tr.innerHTML = `<td><strong>${b.name}</strong></td>
        <td>${oversStr(b.balls)}</td><td>${b.maidens}</td><td>${b.runs}</td>
        <td>${b.wickets}</td><td>${eco}</td><td>${b.wides}</td><td>${b.noballs}</td>`;
      bb.appendChild(tr);
    });
    bwlT.appendChild(bb);
    sec.appendChild(bwlT);

    // fall of wickets
    if (i.fowList.length) {
      const fow = document.createElement('div');
      fow.className = 'sc-fow';
      fow.innerHTML = '<strong>Fall of Wickets: </strong>' +
        i.fowList.map(f => `<span>${f.wicket}-${f.runs} (${f.batsmanName}, ${f.over})</span>`).join(' · ');
      sec.appendChild(fow);
    }

    body.appendChild(sec);
  });

  if (match.result) {
    body.insertAdjacentHTML('beforeend',
      `<div style="text-align:center;padding:24px;color:var(--green);font-size:1.1rem;font-weight:700;">🏆 ${match.result}</div>`);
  }
}

// opens a print-friendly scorecard in a new tab
function exportPDF() {
  buildScorecard();
  const html = document.getElementById('scorecardBody').innerHTML;
  const win  = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Scorecard — ${match?.team1 || ''} vs ${match?.team2 || ''}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#000;background:#fff;}
      table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:0.85rem;}
      th,td{border:1px solid #ccc;padding:6px 8px;}
      th{background:#e8e8e8;font-weight:700;}
      td:not(:first-child),th:not(:first-child){text-align:center;}
      .sc-innings-title{font-size:1rem;font-weight:700;padding:8px;background:#dde;margin:12px 0 6px;border-radius:4px;}
      .sc-extras,.sc-total{padding:6px 8px;font-size:0.83rem;}
      .sc-total{font-weight:700;}
      .sc-fow{font-size:0.8rem;padding:6px 0;color:#555;}
      .out-text{font-size:0.78rem;color:#666;}
      .dnb{color:#999;font-style:italic;}
    </style></head><body>
    <h2>🏏 CreaseControl — Match Scorecard</h2>
    <p><strong>${match?.team1 || ''} vs ${match?.team2 || ''}</strong> · ${match?.format || ''}
    ${match?.format !== 'Test' ? '· ' + (match?.totalOvers || '') + ' overs' : ''}</p>
    <p>Toss: ${match?.tossWinner || ''} won, elected to ${match?.tossDecision === 'bat' ? 'bat' : 'bowl'} first</p>
    ${html}
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}