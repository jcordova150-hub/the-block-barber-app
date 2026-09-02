let staffPassword = localStorage.getItem('staffPassword') || '';
let clients = [];
let settings = null;
let selectedId = null;

function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function fmtDate(iso){
  const [y,m,d] = iso.split('-');
  return d+'/'+m+'/'+y;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function api(path, options = {}){
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
  if(staffPassword) headers['x-staff-password'] = staffPassword;
  const res = await fetch(path, Object.assign({}, options, {headers}));
  if(res.status === 401){
    doLogout();
    throw new Error('No autorizado');
  }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

// ---------- Login ----------

document.getElementById('loginBtn').addEventListener('click', attemptLogin);

function togglePasswordField(inputEl, btnEl){
  const showing = inputEl.type === 'text';
  inputEl.type = showing ? 'password' : 'text';
  btnEl.textContent = showing ? '👁' : '🙈';
  btnEl.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
}
document.getElementById('toggleLoginPass').addEventListener('click', ()=>{
  togglePasswordField(document.getElementById('loginPassword'), document.getElementById('toggleLoginPass'));
});
document.getElementById('loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') attemptLogin(); });

async function attemptLogin(){
  const pass = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try{
    const res = await fetch('/api/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password: pass})
    });
    const data = await res.json();
    if(!res.ok || !data.ok){
      errEl.textContent = 'Contraseña incorrecta.';
      return;
    }
    staffPassword = pass;
    localStorage.setItem('staffPassword', pass);
    await boot();
  }catch(e){
    errEl.textContent = 'No se pudo conectar con el servidor.';
  }
}

function doLogout(){
  staffPassword = '';
  localStorage.removeItem('staffPassword');
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPassword').value = '';
}
document.getElementById('logoutBtn').addEventListener('click', doLogout);

// ---------- Arranque ----------

async function boot(){
  try{
    settings = await api('/api/settings');
    clients = await api('/api/clients');
  }catch(e){
    // password guardada ya no sirve
    doLogout();
    return;
  }
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  renderBiz();
  renderClientList();
  renderCard();
}

function renderBiz(){
  document.getElementById('bizName').textContent = settings.name;
  document.getElementById('bizTaglineDisplay').textContent = settings.tagline;
  document.getElementById('loginBizName').textContent = settings.name;
}

// ---------- Lista de clientes ----------

function renderClientList(){
  const list = document.getElementById('clientList');
  if(clients.length === 0){
    list.innerHTML = '<div class="empty">Aún no hay clientes dados de alta.</div>';
    return;
  }
  list.innerHTML = '';
  clients.slice().sort((a,b)=> a.name.localeCompare(b.name,'es')).forEach(c=>{
    const row = document.createElement('div');
    row.className = 'client-row' + (c.id === selectedId ? ' active' : '');
    row.innerHTML =
      '<div><div class="name">'+escapeHtml(c.name)+'</div><div class="meta">'+(c.phone? escapeHtml(c.phone) : 'Sin teléfono')+'</div></div>'+
      '<div class="count">'+c.stamps.length+'/'+settings.stampsNeeded+'</div>';
    row.addEventListener('click', ()=>{ selectedId = c.id; renderClientList(); renderCard(); });
    list.appendChild(row);
  });
}

// ---------- Tarjeta ----------

const REWARD_LABELS = ['50%<br>Descuento', 'Corte<br>Gratis'];

function buildStampRow(stampedCount, rowStart, perRow, rowIndex){
  let h = '<div class="stamp-row" style="grid-template-columns: repeat('+perRow+', 1fr) 1.3fr;">';
  for(let i=0;i<perRow;i++){
    const idx = rowStart+i;
    h += idx < stampedCount
      ? '<div class="stamp-slot filled"><div class="stamp-mark"><img src="/assets/logo.jpg" alt="Sello"></div></div>'
      : '<div class="stamp-slot">'+(idx+1+rowIndex)+'</div>';
  }
  const earned = stampedCount >= (rowStart+perRow);
  const label = REWARD_LABELS[rowIndex] || 'Premio';
  h += '<div class="reward-box'+(earned?' earned':'')+'">'+label+'</div>';
  h += '</div>';
  return h;
}

function renderCard(){
  const stage = document.getElementById('cardStage');
  const client = clients.find(c => c.id === selectedId);
  if(!client){
    stage.innerHTML = '<div class="empty">Selecciona un cliente de la lista, o da de alta uno nuevo, para ver su tarjeta de sellos.</div>';
    return;
  }
  const stamped = client.stamps.length;
  const perRow = settings.stampsPerRow;
  const total = settings.stampsNeeded;
  const complete = stamped >= total;
  const stampedToday = client.stamps.includes(todayStr());

  let rowsHtml = '';
  let rowIdx = 0;
  for(let start = 0; start < total; start += perRow){
    rowsHtml += buildStampRow(stamped, start, Math.min(perRow, total-start), rowIdx);
    rowIdx++;
  }

  const publicUrl = window.location.origin + '/card/' + client.id;

  stage.innerHTML =
    '<div class="card-stage">'+
      '<div class="ticket" id="ticketToDownload">'+
        '<div class="ticket-head">'+
          '<img src="/assets/logo.jpg" alt="Logo">'+
          '<div>'+
            '<div class="ticket-biz-name">'+escapeHtml(settings.name)+'</div>'+
            '<div class="ticket-biz-tag">'+escapeHtml(settings.tagline)+'</div>'+
          '</div>'+
          '<div class="ticket-client">'+
            '<div class="cname">'+escapeHtml(client.name)+'</div>'+
            '<div class="cphone">'+(client.phone?escapeHtml(client.phone):'')+'</div>'+
          '</div>'+
        '</div>'+
        (complete ? '<div class="reward-banner">Tarjeta completa</div>' : '')+
        rowsHtml+
        '<div class="ticket-foot">'+
          '<span>Cliente desde '+fmtDate(client.createdAt)+'</span>'+
          (settings.phone ? '<span class="phone">Citas al: '+escapeHtml(settings.phone)+'</span>' : '<span>'+stamped+' de '+total+' visitas</span>')+
        '</div>'+
        '<div class="personal-qr-row">'+
          '<div class="ticket-qr" id="ticketQrBox"></div>'+
          '<div class="personal-qr-label">Escanea aquí<br>para ver tu<br>tarjeta en vivo</div>'+
        '</div>'+
      '</div>'+
      '<div class="actions">'+
        (complete
          ? '<button class="btn" id="resetBtn">Reclamar y reiniciar tarjeta</button>'
          : '<button class="btn" id="stampBtn" '+(stampedToday?'disabled':'')+'>'+(stampedToday? 'Ya sellado hoy' : 'Sellar visita de hoy')+'</button>'
        )+
        '<button class="btn ghost" id="deleteBtn">Eliminar cliente</button>'+
      '</div>'+
      '<div class="note">Link fijo y en vivo de este cliente:<br>'+escapeHtml(publicUrl)+'</div>'+
    '</div>';

  const stampBtn = document.getElementById('stampBtn');
  if(stampBtn) stampBtn.addEventListener('click', ()=> addStamp(client.id));
  const resetBtn = document.getElementById('resetBtn');
  if(resetBtn) resetBtn.addEventListener('click', ()=> resetCard(client.id));
  document.getElementById('deleteBtn').addEventListener('click', ()=> deleteClient(client.id));

  const qrBox = document.getElementById('ticketQrBox');
  qrBox.innerHTML = '';
  if(window.QRCode){
    new QRCode(qrBox, { text: publicUrl, width: 100, height: 100, colorDark:'#000000', colorLight:'#ffffff', correctLevel: QRCode.CorrectLevel.M });
  }
}

async function addStamp(id){
  try{
    const updated = await api('/api/clients/'+id+'/stamp', {method:'POST'});
    clients = clients.map(c => c.id === id ? updated : c);
    renderClientList();
    renderCard();
  }catch(e){ alert('No se pudo poner el sello: '+e.message); }
}

async function resetCard(id){
  try{
    const updated = await api('/api/clients/'+id+'/reset', {method:'POST'});
    clients = clients.map(c => c.id === id ? updated : c);
    renderClientList();
    renderCard();
  }catch(e){ alert('No se pudo reiniciar: '+e.message); }
}

async function deleteClient(id){
  if(!confirm('¿Eliminar a este cliente y su historial de sellos?')) return;
  try{
    await api('/api/clients/'+id, {method:'DELETE'});
    clients = clients.filter(c=>c.id!==id);
    if(selectedId === id) selectedId = null;
    renderClientList();
    renderCard();
  }catch(e){ alert('No se pudo eliminar: '+e.message); }
}

// ---------- Alta de cliente ----------

document.getElementById('addClientBtn').addEventListener('click', async ()=>{
  const nameEl = document.getElementById('newName');
  const phoneEl = document.getElementById('newPhone');
  const errEl = document.getElementById('addError');
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  if(!name){ errEl.textContent = 'Escribe el nombre del cliente.'; return; }
  errEl.textContent = '';
  try{
    const newClient = await api('/api/clients', {method:'POST', body: JSON.stringify({name, phone})});
    clients.push(newClient);
    selectedId = newClient.id;
    nameEl.value=''; phoneEl.value='';
    renderClientList();
    renderCard();
  }catch(e){ errEl.textContent = e.message; }
});

// ---------- Configuración del negocio ----------

document.getElementById('editBizBtn').addEventListener('click', ()=>{
  const root = document.getElementById('modalRoot');
  root.innerHTML =
    '<div class="modal-bg" id="modalBg">'+
      '<div class="modal">'+
        '<h3>Datos del negocio</h3>'+
        '<label>Nombre del negocio</label>'+
        '<input id="bizNameInput" value="'+escapeHtml(settings.name)+'" maxlength="40">'+
        '<label>Frase / lema</label>'+
        '<input id="bizTagInput" value="'+escapeHtml(settings.tagline)+'" maxlength="40">'+
        '<label>Teléfono para citas</label>'+
        '<input id="bizPhoneInput" value="'+escapeHtml(settings.phone||'')+'" maxlength="30">'+
        '<label>Sellos necesarios para el premio</label>'+
        '<input id="bizStampsInput" type="number" min="1" max="30" value="'+settings.stampsNeeded+'">'+
        '<label>Nueva contraseña de personal (dejar vacío para no cambiar)</label>'+
        '<div class="pass-wrap"><input id="bizPassInput" type="password" placeholder="••••••••"><button type="button" class="eye-btn" id="toggleBizPass" aria-label="Mostrar contraseña">👁</button></div>'+
        '<div class="error-text" id="bizError"></div>'+
        '<div class="row">'+
          '<button class="btn ghost" id="bizCancel">Cancelar</button>'+
          '<button class="btn" id="bizSave">Guardar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.getElementById('bizCancel').addEventListener('click', ()=> root.innerHTML='');
  document.getElementById('toggleBizPass').addEventListener('click', ()=>{
    togglePasswordField(document.getElementById('bizPassInput'), document.getElementById('toggleBizPass'));
  });
  document.getElementById('bizSave').addEventListener('click', async ()=>{
    const n = document.getElementById('bizNameInput').value.trim();
    const t = document.getElementById('bizTagInput').value.trim();
    const p = document.getElementById('bizPhoneInput').value.trim();
    const sn = document.getElementById('bizStampsInput').value;
    const newPass = document.getElementById('bizPassInput').value;
    if(!n){ document.getElementById('bizError').textContent = 'El nombre no puede estar vacío.'; return; }
    try{
      settings = await api('/api/settings', {method:'PUT', body: JSON.stringify({
        name:n, tagline:t, phone:p, stampsNeeded: sn, newPassword: newPass || undefined
      })});
      if(newPass){
        staffPassword = newPass;
        localStorage.setItem('staffPassword', newPass);
      }
      renderBiz();
      renderCard();
      root.innerHTML='';
    }catch(e){
      document.getElementById('bizError').textContent = e.message;
    }
  });
});

// ---------- Arranque inicial ----------

if(staffPassword){
  boot();
} else {
  document.getElementById('loginScreen').style.display = 'flex';
}
