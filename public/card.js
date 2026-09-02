function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmtDate(iso){
  const [y,m,d] = iso.split('-');
  return d+'/'+m+'/'+y;
}

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

async function load(){
  const wrap = document.getElementById('wrap');
  const id = window.location.pathname.split('/').pop();
  try{
    const res = await fetch('/api/card/'+id);
    if(!res.ok){
      wrap.innerHTML = '<div class="empty">No se encontró esta tarjeta. Verifica el link con tu barbería.</div>';
      return;
    }
    const data = await res.json();
    render(data);
  }catch(e){
    wrap.innerHTML = '<div class="empty">No se pudo cargar tu tarjeta. Verifica tu conexión e intenta de nuevo.</div>';
  }
}

function render(data){
  const { client, business } = data;
  const stamped = client.stamps.length;
  const perRow = business.stampsPerRow;
  const total = business.stampsNeeded;
  const complete = stamped >= total;

  let rowsHtml = '';
  let rowIdx = 0;
  for(let start = 0; start < total; start += perRow){
    rowsHtml += buildStampRow(stamped, start, Math.min(perRow, total-start), rowIdx);
    rowIdx++;
  }

  const wrap = document.getElementById('wrap');
  wrap.innerHTML =
    '<div>'+
      '<div class="ticket">'+
        '<div class="ticket-head">'+
          '<img src="/assets/logo.jpg" alt="Logo">'+
          '<div>'+
            '<div class="ticket-biz-name">'+escapeHtml(business.name)+'</div>'+
            '<div class="ticket-biz-tag">'+escapeHtml(business.tagline)+'</div>'+
          '</div>'+
          '<div class="ticket-client">'+
            '<div class="cname">'+escapeHtml(client.name)+'</div>'+
            '<div class="cphone">'+(client.phone?escapeHtml(client.phone):'')+'</div>'+
          '</div>'+
        '</div>'+
        (complete ? '<div class="reward-banner">¡Tienes un premio disponible!</div>' : '')+
        rowsHtml+
        '<div class="ticket-foot">'+
          '<span>Cliente desde '+fmtDate(client.createdAt)+'</span>'+
          (business.phone ? '<span class="phone">Citas al: '+escapeHtml(business.phone)+'</span>' : '<span>'+stamped+' de '+total+' visitas</span>')+
        '</div>'+
      '</div>'+
      '<div class="note">Esta tarjeta se actualiza en vivo cada vez que visitas la barbería.</div>'+
    '</div>';
}

load();
