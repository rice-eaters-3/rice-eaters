'use strict';
// Inline SVG illustrations are generated locally from validated public metadata.
// They do not fetch external images or expose investigation card back text.
window.MysteryArt=(function(){
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hash=s=>Array.from(String(s||'')).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,7)>>>0;
  const themes={
    'd1-crown-of-ashes':['#342842','#80617d','#e4c5a0'],
    'cruel-heart-island':['#42314d','#be7895','#f5d3ad'],
    'neon-memory-quarantine':['#112b3d','#2784b4','#82e8d8'],
    'stellar-academy-first-case':['#26364e','#6b729f','#f3dba6']
  };
  const palette=story=>themes[story]||['#2b354a','#9b8cb2','#e9cbab'];
  function portrait(c,story,compact=false){
    const key=c.id||c.name||'hero',n=hash(key),[dark,light,gold]=palette(story);
    const hair=['#171821','#433028','#b8a079','#282a3c','#644d39','#d2c7bb'][n%6],
      skin=['#f0c7ae','#ecc1ab','#dcb49b','#f0ccb4'][n%4],
      eyes=['#5b504d','#6c6d8b','#8b6345','#4e706b'][n%4];
    const suit=c.accent&&/^#[0-9a-fA-F]{6}$/.test(c.accent)?c.accent:light;
    const part=n%4,head= n%3===0?'<path d="M66 105Q65 30 120 29Q175 30 173 111L165 87Q145 73 121 62Q95 93 70 90Z" fill="'+hair+'"/>':
      n%3===1?'<path d="M58 137Q43 43 97 35Q156 10 180 67Q194 122 173 159L163 94Q151 54 116 72Q84 61 70 99Z" fill="'+hair+'"/>':
      '<path d="M63 125Q49 50 95 35Q160 18 177 83L167 117Q148 56 128 70Q101 85 70 90Z" fill="'+hair+'"/>';
    const accessory=key.includes('cloud')||key==='cloud'?'<path d="M73 39Q66 13 93 16Q102 2 119 15Q138 2 147 18Q174 9 168 41Z" fill="#f6f2ec" stroke="#a4a7ab" stroke-width="3"/><rect x="81" y="35" width="76" height="16" rx="4" fill="#f5f1eb"/>':
      key==='mayushi'?'<path d="M174 85l32-15-14 26-19 1" fill="#b36a96"/><path d="M185 81l15 4" stroke="#e7c48d" stroke-width="5"/>':
      key==='hasu'||key==='jobi'?'<path d="M61 118Q40 84 52 69M181 70q14 17 4 48" fill="none" stroke="#23252f" stroke-width="11"/><rect x="43" y="107" width="19" height="34" rx="7" fill="#414552"/><rect x="179" y="107" width="19" height="34" rx="7" fill="#414552"/>':
      key==='karl'||key==='ion'?'<path d="M84 71L73 59M159 71l12-12" stroke="'+gold+'" stroke-width="4"/>':'';
    const specs=n%5===0?'<rect x="78" y="111" width="37" height="20" rx="8" stroke="#31313b" stroke-width="5" fill="none"/><rect x="125" y="111" width="37" height="20" rx="8" stroke="#31313b" stroke-width="5" fill="none"/><path d="M115 119h10" stroke="#31313b" stroke-width="5"/>':'';
    const collar=(part===1?'<path d="M84 206l35 31-21 18-33-47M155 206l-35 31 21 18 33-47" fill="'+gold+'" opacity=".65"/>':
      '<path d="M90 207l30 32 29-32" fill="none" stroke="'+gold+'" stroke-width="8" stroke-linejoin="round"/>');
    return '<svg class="mystery-portrait '+(compact?'portrait-compact':'')+'" viewBox="0 0 240 260" role="img" aria-label="'+escape(c.name)+' 캐릭터 일러스트" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><linearGradient id="pbg'+n+'" x2="1" y2="1"><stop stop-color="'+dark+'"/><stop offset="1" stop-color="'+light+'"/></linearGradient><linearGradient id="pcoat'+n+'"><stop stop-color="'+suit+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient></defs>'+
      '<rect width="240" height="260" rx="16" fill="url(#pbg'+n+')"/>'+
      '<circle cx="188" cy="43" r="63" fill="'+gold+'" opacity=".08"/><path d="M0 216L240 162V260H0Z" fill="'+dark+'" opacity=".42"/>'+
      '<path d="M28 259Q31 202 75 196L99 187L120 201L144 187Q194 199 211 259Z" fill="url(#pcoat'+n+')" stroke="'+gold+'" stroke-opacity=".45" stroke-width="2"/>'+
      '<path d="M100 171v29q19 22 40 0v-29" fill="'+skin+'"/>'+
      '<ellipse cx="120" cy="115" rx="53" ry="69" fill="'+skin+'"/>'+
      '<path d="M81 117q13-12 27-2M133 115q13-11 27 2" fill="none" stroke="'+hair+'" stroke-width="3"/>'+
      '<ellipse cx="97" cy="120" rx="5" ry="6" fill="'+eyes+'"/><ellipse cx="145" cy="120" rx="5" ry="6" fill="'+eyes+'"/>'+
      '<path d="M120 124l-4 23 8 2" stroke="#ac7d70" stroke-width="2" fill="none"/>'+
      '<path d="M105 161q15 8 30 0" stroke="#9b5c58" stroke-width="3" fill="none" stroke-linecap="round"/>'+
      head+accessory+specs+collar+
      '<path d="M21 237l50-25M215 237l-50-25" stroke="'+gold+'" stroke-width="2" opacity=".35"/>'+
      '<rect x="8" y="8" width="224" height="244" rx="12" stroke="'+gold+'" stroke-opacity=".32" stroke-width="2" fill="none"/>'+
      '</svg>';
  }
  const iconByKind={
    knife:'🔪',gargoyle:'🗿',book:'📖',badge:'🪪',computer:'🖥️',camera:'🎥',
    chemistry:'🧪',clock:'🕰️',map:'🗺️',letter:'✉️',ship:'⚓',heart:'💌',
    data:'💾',chip:'💠',medical:'🩺',star:'🔭',key:'🗝️',evidence:'🔎'
  };
  function clueKind(c){
    const s=(c.title||'')+' '+(c.subtitle||'');
    const patterns=[
      [/식칼|칼|블레이드|무기/, 'knife'],[/가고일|석상|조형물|왕좌|조각상/,'gargoyle'],
      [/노트|수첩|일지|책|정관|원고|연감/,'book'],[/출입|태그|배지|신분증/,'badge'],
      [/연습실|서버|컴퓨터|단말|장비실/,'computer'],[/CCTV|카메라|드론|촬영|영상/,'camera'],
      [/오염|진료|시신|뇌|의료|검시/,'medical'],[/시계|시각|시간|로그/,'clock'],
      [/지도|통로|지도|도면|탈출|계단/,'map'],[/계약|편지|문서|영수증|메모|쪽지/,'letter'],
      [/해양|선착장|배|파도|물때|조수/,'ship'],[/연애|하트|감정|커플/,'heart'],
      [/기억|복제|데이터|EMP|디지털/,'chip'],[/별|천체|관측|플라네타륨/,'star'],
      [/열쇠|키|암호|금고/,'key']
    ];
    return patterns.find(([re])=>re.test(s))?.[1]||'evidence';
  }
  function clue(c,story){
    const id=hash(c.id||c.title),[dark,light,gold]=palette(story),kind=clueKind(c),icon=iconByKind[kind];
    const circles=Array.from({length:7},(_,i)=>'<circle cx="'+(25+(id*(i+3)%280))+'" cy="'+(18+(id*(i+11)%170))+'" r="'+(10+(id*(i+7)%30))+'" stroke="'+gold+'" stroke-opacity=".15" fill="none"/>').join('');
    return '<svg class="mystery-clue-art" viewBox="0 0 320 190" role="img" aria-label="'+escape(c.title)+' 조사 일러스트" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><linearGradient id="c'+id+'" x2="1" y2="1"><stop stop-color="'+dark+'"/><stop offset=".64" stop-color="'+light+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient></defs>'+
      '<rect width="320" height="190" rx="12" fill="url(#c'+id+')"/>'+circles+
      '<path d="M19 20h282v150H19z" fill="none" stroke="'+gold+'" stroke-width="2" stroke-opacity=".58"/>'+
      '<path d="M32 38H88M232 38h56M32 152h68M222 152h66" stroke="'+gold+'" stroke-width="2" stroke-opacity=".6"/>'+
      '<circle cx="160" cy="91" r="59" fill="'+gold+'" fill-opacity=".18" stroke="'+gold+'" stroke-opacity=".4"/>'+
      '<text x="160" y="118" font-size="75" text-anchor="middle" filter="drop-shadow(0 5px 6px #15202a88)">'+icon+'</text>'+
      '<rect x="95" y="164" width="130" height="3" rx="2" fill="'+gold+'" opacity=".76"/>'+
      '</svg>';
  }
  const props={
    sink:'🚰',fridge:'🧊',pc:'🖥️',gargoyle:'🗿',throne:'👑',stove:'🍳',table:'🪑',shelf:'📚',
    bed:'🛏️',sofa:'🛋️',camera:'📷',boat:'⛵',terminal:'🖥️',telescope:'🔭',
    projector:'🌌',server:'🖧',medical:'🩺',pod:'⚗️',generator:'⚡',
    cabinet:'🗄️',desk:'🖥️',stairs:'🪜',fireplace:'🔥',plant:'🪴',
    wardrobe:'🪞',fountain:'⛲',statue:'🗿',door:'🚪',other:'✧'
  };
  const object=o=>'<span class="map-prop-icon" aria-hidden="true">'+escape(o.icon||props[o.kind]||props.other)+'</span>';
  return {portrait,clue,object,clueKind};
})();
