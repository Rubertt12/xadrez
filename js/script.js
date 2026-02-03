const peoes = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const nobres = ['T1','C1','B1','Q1','K1','B2','C2','T2'];

const getInitialBoard = () => [
    ...nobres.map(id => id + '_P'), ...peoes.map(id => id + '_P'),
    ...Array(32).fill(null),
    ...peoes.map(id => id + '_B'), ...nobres.map(id => id + '_B')
];

let db, store = { p: {}, g: {killsB:0, killsP:0, avatarB:'', avatarP:''}, board: getInitialBoard() };
let ambientAudios = { Ambiente: new Audio(), Entrada: new Audio(), Intro1: new Audio(), Intro2: new Audio() };
let audioAtk = new Audio(), audioDef = new Audio();
let isLive = false, turn = 'B', sel = null, pending = null;
let fadeInterval = null;

const req = indexedDB.open("WarEngine_v33_2", 1);
req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
req.onsuccess = e => { db = e.target.result; loadData(); };

function loadData() {
    db.transaction("assets").objectStore("assets").get("all").onsuccess = e => {
        if(e.target.result) store = e.target.result;
        if(!store.board) store.board = getInitialBoard();
        renderBoard(); 
        updateUI(); 
        renderConfigLists(); 
        setupAmbientUI();
    };
}

function setupAmbientUI() {
    const cont = document.getElementById('ambient-controls'); 
    cont.innerHTML = '';
    ['Ambiente', 'Entrada', 'Intro1', 'Intro2'].forEach(type => {
        if(store.g['snd'+type]) ambientAudios[type].src = store.g['snd'+type];
        ambientAudios[type].loop = (type === 'Ambiente');
        const div = document.createElement('div');
        div.style = "background: #000; padding: 8px; border-radius: 5px; border: 1px solid #333;";
        div.innerHTML = `<div style="font-size:10px; margin-bottom:5px; color:#aaa">${type.toUpperCase()}</div>
            <input type="file" style="font-size:10px; width:100%" onchange="upAmb('${type}', this)">
            <div style="display:flex; gap:5px; margin-top:5px">
                <button class="btn" onclick="ambientAudios['${type}'].play()" style="flex:1; background:#004444">▶</button>
                <button class="btn" onclick="ambientAudios['${type}'].pause()" style="flex:1; background:#440000">||</button>
            </div>`;
        cont.appendChild(div);
    });
}

function fadeAmbient(targetVol, duration = 1000) {
    clearInterval(fadeInterval);
    const masterVol = parseFloat(document.getElementById('v-master').value);
    const finalTarget = targetVol * masterVol;
    const step = 0.05;
    const intervalTime = duration / (1 / step);
    fadeInterval = setInterval(() => {
        let allDone = true;
        Object.values(ambientAudios).forEach(audio => {
            if (!audio.paused) {
                if (Math.abs(audio.volume - finalTarget) > step) {
                    audio.volume += (audio.volume < finalTarget) ? step : -step;
                    allDone = false;
                } else { audio.volume = finalTarget; }
            }
        });
        if (allDone) clearInterval(fadeInterval);
    }, intervalTime);
}

function upAmb(t, i) {
    const r = new FileReader(); 
    r.onload = e => { store.g['snd'+t] = e.target.result; ambientAudios[t].src = e.target.result; save(); };
    r.readAsDataURL(i.files[0]);
}

function updateMasterVolume() {
    const v = document.getElementById('v-master').value;
    Object.values(ambientAudios).forEach(a => a.volume = v);
    audioAtk.volume = v; audioDef.volume = v;
}

function renderBoard() {
    const b = document.getElementById('board'); 
    const wrapper = document.querySelector('.board-wrapper');
    b.innerHTML = '';
    wrapper.querySelectorAll('.coord').forEach(c => c.remove());
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const edit = document.getElementById('edit-mode').checked;

    store.board.forEach((id, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        if (col === 0) {
            const numLabel = document.createElement('div');
            numLabel.className = 'coord coord-v';
            numLabel.style.top = `calc(30px + ${row} * (min(88vw, 70vh) / 8))`;
            numLabel.innerText = 8 - row;
            wrapper.appendChild(numLabel);
        }
        if (row === 0) {
            const letLabel = document.createElement('div');
            letLabel.className = 'coord coord-h';
            letLabel.style.left = `calc(30px + ${col} * (min(88vw, 70vh) / 8))`;
            letLabel.innerText = letras[col];
            wrapper.appendChild(letLabel);
        }
        const sq = document.createElement('div'); 
        sq.className = `sq ${(row + col) % 2 == 0 ? 'l' : 'd'}`;
        sq.onclick = () => handleSq(i);
        if(id) {
            const c = document.createElement('div'); c.className='piece-container';
            const p = document.createElement('div'); p.className='piece';
            if(store.p[id]?.img) p.style.backgroundImage = `url(${store.p[id].img})`;
            else p.style.backgroundColor = id.endsWith('_B') ? '#fff' : '#f05';
            c.appendChild(p);
            if(edit) {
                const x = document.createElement('div'); 
                x.innerHTML='×'; 
                x.style="position:absolute;top:-5px;right:-5px;background:red;border-radius:50%;width:15px;height:15px;display:flex;justify-content:center;align-items:center;cursor:pointer;font-size:10px;border:1px solid white";
                x.onclick=(e)=>{e.stopPropagation(); store.board[i]=null; renderBoard(); save();};
                c.appendChild(x);
            }
            sq.appendChild(c);
        }
        b.appendChild(sq);
    });
}

function handleSq(i) {
    if(!isLive) return;
    const free = document.getElementById('free-move').checked;
    if(sel === null) {
        if(store.board[i] && (free || store.board[i].endsWith('_' + turn))) {
            sel = i; 
            renderBoard(); 
            document.getElementById('board').children[i].style.background = "#004444";
        }
    } else {
        const pecaOrigem = store.board[sel];
        const pecaDestino = store.board[i];
        if (sel === i) { sel = null; renderBoard(); return; }
        if (pecaDestino && pecaDestino.endsWith(pecaOrigem.slice(-2))) {
            sel = i; renderBoard();
            document.getElementById('board').children[i].style.background = "#004444";
            return;
        }
        if (pecaDestino) {
            pending = {f: sel, t: i};
            openArena();
        } else {
            store.board[i] = pecaOrigem;
            store.board[sel] = null;
            if(!free) nextTurn(); else { sel = null; renderBoard(); save(); }
        }
    }
}

function openArena() {
    const idA = store.board[pending.f];
    const idD = store.board[pending.t];
    fadeAmbient(0.1);
    const pBranca = idA.endsWith('_B') ? idA : idD;
    const pPreta = idA.endsWith('_P') ? idA : idD;
    document.getElementById('a-img').style.backgroundImage = `url(${store.p[pBranca]?.img || ''})`;
    document.getElementById('d-img').style.backgroundImage = `url(${store.p[pPreta]?.img || ''})`;
    audioAtk.src = store.p[idA]?.snd || ""; 
    audioDef.src = store.p[idD]?.snd || "";
    const master = document.getElementById('v-master').value;
    audioAtk.volume = (store.p[idA]?.vol ?? 0.7) * master;
    audioDef.volume = (store.p[idD]?.vol ?? 0.7) * master;
    
    // Vincula áudios aos botões de lado fixo
    const isAtkWhite = idA.endsWith('_B');
    document.getElementById('btn-play-L').onclick = () => isAtkWhite ? audioAtk.play() : audioDef.play();
    document.getElementById('btn-pause-L').onclick = () => isAtkWhite ? audioAtk.pause() : audioDef.pause();
    document.getElementById('btn-play-R').onclick = () => isAtkWhite ? audioDef.play() : audioAtk.play();
    document.getElementById('btn-pause-R').onclick = () => isAtkWhite ? audioDef.pause() : audioAtk.pause();
    document.getElementById('arena').style.display='flex';
}

function finishDuel(vencedorCor) {
    audioAtk.pause(); audioDef.pause();
    const idAtacante = store.board[pending.f];
    const corAtacante = idAtacante.endsWith('_B') ? 'B' : 'P';
    if(vencedorCor === 'B') store.g.killsB++; else store.g.killsP++;

    if (vencedorCor === corAtacante) {
        store.board[pending.t] = idAtacante;
        store.board[pending.f] = null;
    } else {
        store.board[pending.f] = null;
    }

    updateUI(); // Atualiza o placar na tela na hora!
    document.getElementById('arena').style.display = 'none';
    fadeAmbient(1); 
    checkGameOver(); 
    const free = document.getElementById('free-move').checked;
    if(!free) nextTurn(); else { sel = null; renderBoard(); save(); }
}

function checkGameOver() {
    const wb = store.board.filter(p => p?.endsWith('_B')).length;
    const pb = store.board.filter(p => p?.endsWith('_P')).length;
    if (wb === 0 || pb === 0) {
        isLive = false;
        const vitorioso = wb === 0 ? 'P' : 'B';
        document.getElementById('victory-photo').style.backgroundImage = `url(${store.g['avatar'+vitorioso]})`;
        document.getElementById('winner-name').innerText = `EXÉRCITO DAS ${wb===0?'PRETAS':'BRANCAS'}`;
        document.getElementById('victory-modal').style.display = 'flex';
    }
}

function renderConfigLists() {
    ['white','black'].forEach(s => {
        const team = s==='white'?'B':'P', cont = document.getElementById('list-'+s);
        cont.innerHTML = `<h3>${s.toUpperCase()}</h3>`;
        [...nobres, ...peoes].forEach(p => {
            const id = `${p}_${team}`; 
            if(!store.p[id]) store.p[id] = {vol: 0.7};
            const d = document.createElement('div'); 
            d.className = 'unit-card';
            d.innerHTML = `<b>${id}</b><br>IMG: <input type="file" onchange="upPiece('${id}','img',this)">
            SOM: <input type="file" onchange="upPiece('${id}','snd',this)">
            VOL: <input type="range" min="0" max="1" step="0.1" value="${store.p[id].vol}" oninput="store.p['${id}'].vol=parseFloat(this.value);save()">`;
            cont.appendChild(d);
        });
    });
}

function upPiece(id, t, i) {
    const r = new FileReader(); 
    r.onload = e => { store.p[id][t] = e.target.result; save(); renderBoard(); };
    r.readAsDataURL(i.files[0]);
}

function upAvatar(s, i) {
    const r = new FileReader(); 
    r.onload = e => { store.g['avatar'+s] = e.target.result; save(); updateUI(); };
    r.readAsDataURL(i.files[0]);
}

function showTab(t) {
    ['white','black','sys'].forEach(id => document.getElementById('list-'+id).style.display = (id===t?'block':'none'));
    ['t-white','t-black','t-sys'].forEach(id => document.getElementById(id).className = (id==='t-'+t?'active':''));
}

function nextTurn() { turn = turn==='B'?'P':'B'; sel=null; renderBoard(); updateUI(); save(); }

function closeArena() { 
    document.getElementById('arena').style.display='none'; 
    audioAtk.pause(); audioDef.pause(); 
    fadeAmbient(1); 
}

function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function startBattle() { isLive=true; toggleMenu(); updateUI(); }

function rollInitiative() { 
    turn = Math.random() < 0.5 ? 'B' : 'P'; 
    updateUI(); 
    alert("Começa: " + (turn==='B'?'BRANCO':'PRETO')); 
}

function updateUI() {
    document.getElementById('score-B').innerText = store.g.killsB; 
    document.getElementById('score-P').innerText = store.g.killsP;
    document.getElementById('img-B').style.backgroundImage = `url(${store.g.avatarB})`; 
    document.getElementById('img-P').style.backgroundImage = `url(${store.g.avatarP})`;
    document.getElementById('card-B').className = 'player-card' + (turn==='B'&&isLive?' active-B':'');
    document.getElementById('card-P').className = 'player-card' + (turn==='P'&&isLive?' active-P':'');
}

function clearBoardPieces() {
    if(confirm("Deseja remover todas as peças do tabuleiro?")) {
        store.board = Array(64).fill(null);
        renderBoard(); save();
    }
}

function save() { if(db) db.transaction("assets","readwrite").objectStore("assets").put(store,"all"); }

function resetGame() { 
    if(confirm("⚠️ Reset total?")) { 
        store = { p: {}, g: {killsB:0, killsP:0, avatarB:'', avatarP:''}, board: getInitialBoard() }; 
        save(); location.reload(); 
    } 
}

window.addEventListener("load", function() {
    const loader = document.getElementById("loader");
    
    // Pequeno atraso para o usuário ver sua logo (opcional)
    setTimeout(() => {
        loader.classList.add("loader-hidden");
    }, 3000); // 3 segundos de carregamento
});

console.log("%cCosplay Chess - Desenvolvido por Rúbertt Ramires", "color: #029191; font-size: 20px; font-weight: bold;");