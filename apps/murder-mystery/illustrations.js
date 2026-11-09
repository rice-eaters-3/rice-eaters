'use strict';
/*
 * Browser-rendered artwork shared by the game and both studio screens.
 * Standalone assets replace matching concept-sheet entries as they are reviewed.
 * Existing sheet entries remain available for the rest of the built-in art.
 */
window.MysteryArt=(function(){
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({
   '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const path='/apps/murder-mystery/assets/';
 const A={
  'd1-crown-of-ashes':{
   file:'d1.webp',size:[1122,1402],palette:['#201b29','#ab7759'],
   portraits:{
    jobi:[20,17,272,282],mayushi:[292,17,266,282],
    chajiwoo:[550,17,298,282],cloud:[850,17,272,282],
    karl:[2,310,287,295],hasu:[284,310,275,295],
    mac:[548,310,305,295],baekikho:[848,310,274,295]
   },
   objects:{
    sink:[5,630,205,235],fridge:[216,630,179,235],stove:[5,630,205,235],
    pc:[392,630,275,235],desk:[392,630,275,235],
    gargoyle:[670,630,222,235],statue:[670,630,222,235],
    throne:[893,630,229,235],table:[893,630,229,235],
    camera:[392,630,275,235],cabinet:[893,630,229,235],
    terminal:[392,630,275,235],server:[392,630,275,235],
    generator:[392,630,275,235],bed:[893,630,229,235],
    plant:[5,630,205,235],shelf:[893,630,229,235]
   },
   doors:{open:[22,898,170,253],closed:[264,898,170,253],locked:[489,898,170,253]},
   stairs:{up:[704,898,173,253],down:[929,898,176,253]},
   clues:{
    knife:[0,1174,191,214],mini:[192,1174,185,214],
    cultbook:[375,1174,201,214],furry:[574,1174,190,214],
    note:[764,1174,187,214],badge:[951,1174,171,214]
   }
  },
  'cruel-heart-island':{
   file:'island.webp',size:[1122,1402],palette:['#3c2639','#e5a1b3'],
   portraits:{
    minjae:[0,86,143,330],doyun:[141,86,143,330],
    seojun:[281,86,146,330],taehan:[421,86,144,330],
    harin:[561,86,145,330],yura:[703,86,143,330],
    nayeon:[840,86,147,330],somi:[981,86,141,330]
   },
   objects:{
    sink:[9,452,276,239],fridge:[287,452,174,239],
    camera:[462,452,315,239],terminal:[7,962,400,201],
    sofa:[781,452,341,239],table:[781,452,341,239],
    fireplace:[41,712,319,205],boat:[724,712,366,205],
    cabinet:[380,712,326,205],plant:[781,452,341,239],
    wardrobe:[409,962,257,201],shelf:[7,962,400,201],
    generator:[925,1210,197,168],server:[711,1210,217,168],
    sink2:[9,452,276,239],desk:[7,962,400,201]
   },
   doors:{open:[665,962,159,201],closed:[824,962,146,201],locked:[972,962,150,201]},
   stairs:{up:[665,962,159,201],down:[824,962,146,201]},
   clues:{
    contract:[0,1208,185,173],drone:[183,1208,181,173],
    shoes:[362,1208,188,173],drive:[550,1208,162,173],
    interview:[711,1208,214,173],warning:[925,1208,197,173]
   }
  },
  'neon-memory-quarantine':{
   file:'neon.webp',size:[1122,1402],palette:['#101d39','#40c1d8'],
   portraits:{
    nova:[0,73,166,314],rune:[162,73,158,314],
    ion:[316,73,162,314],mira:[476,73,161,314],
    atlas:[633,73,166,314],echo:[794,73,170,314],
    sol:[959,73,163,314]
   },
   objects:{
    pod:[17,408,253,263],medical:[274,408,265,263],
    terminal:[547,408,292,263],server:[843,408,265,263],
    generator:[12,686,267,239],cabinet:[290,686,271,239],
    camera:[597,686,220,239],desk:[547,408,292,263],
    sofa:[274,408,265,263]
   },
   doors:{open:[8,958,361,169],closed:[381,958,355,169],locked:[746,958,376,169]},
   stairs:{up:[8,958,361,169],down:[381,958,355,169]},
   clues:{
    chip:[0,1163,196,195],medical:[197,1163,194,195],
    case:[392,1163,197,195],contract:[589,1163,196,195],
    token:[781,1163,141,195],audit:[922,1163,200,195]
   }
  },
  'stellar-academy-first-case':{
   file:'academy.webp',size:[1491,1055],palette:['#253046','#d5b57f'],
   portraits:{
    seoha:[6,166,233,208],taewon:[237,166,197,208],
    yeonju:[434,166,199,208],jinwoo:[632,166,202,208],
    rion:[829,166,207,208],gabin:[1037,166,229,208],
    yeonho:[1275,200,164,177]
   },
   objects:{
    telescope:[17,489,197,121],projector:[214,489,202,121],
    shelf:[418,489,167,121],bed:[590,489,165,121],
    cabinet:[766,489,129,121],desk:[903,489,156,121],
    terminal:[1064,489,190,121],door:[766,489,129,121],
    medical:[903,489,156,121],generator:[1064,489,190,121],
    plant:[214,489,202,121],statue:[214,489,202,121],
    exit:[1255,489,191,121]
   },
   doors:{open:[629,647,175,81],closed:[278,647,170,81],locked:[1022,647,180,81]},
   stairs:{up:[1255,489,191,121],down:[1064,489,190,121]},
   clues:{
    cipher:[9,800,237,194],diary:[244,800,267,194],
    audio:[511,800,240,194],badge:[751,800,208,194],
    experiment:[961,800,245,194],exit:[1205,800,238,194]
   }
  }
 };
 // Existing library aliases and custom scenario IDs retain a graceful fallback.
 const individualClues={
  'd1-crown-of-ashes':new Set([
   'jobi_threat_phone','jobi_stage_mouse','jobi_qualifier_card','jobi_stopwatch',
   'mayushi_oracle_cards','mayushi_spirit_bell','mayushi_fractured_talisman','mayushi_private_stream',
   'chajiwoo_mini_gargoyle','chajiwoo_donation_ledger',
   'chajiwoo_cult_invitation','chajiwoo_unmailed_letter','cloud_tainted_cleaver','cloud_huoguo_ladle',
   'cloud_elephant_eggplant','cloud_oven_receipt','karl_alpaca_notebook','karl_manager_badge',
   'karl_alpaca_receipts','karl_unbroken_promise',
   'hasu_cult_notebook','hasu_marvin_voice','hasu_solo_kill_log',
   'hasu_roof_safety_map','mac_tactical_board','mac_maintenance_glove',
   'mac_coach_whistle','mac_rehearsal_schedule','cult_founder_mask',
   'cult_hero_landing_syllabus',
   'cult_marvin_bill','cult_fund_account','cult_gargoyle_poster',
   'cult_donation_anchor','cult_old_team_photo','cult_unsafe_meeting',
   'cult_founder_signature','cult_mac_scape_plan','cult_member_exit',
   'cult_hidden_fund',
   'time_dinner_receipt',
   'time_kitchen_oven',
   'time_jobi_stair',
   'time_chajiwoo_photo',
   'time_mayushi_warning',
   'time_hasu_terminal',
   'time_karl_badge',
   'time_mac_roof',
   'time_baetho_last_msg',
   'time_key_returns',
   'time_practice_live',
   'time_chef_service',
   'trick_throne_scene',
   'trick_stage_outline',
   'trick_showroom_slot',
   'trick_alarm_script',
   'trick_baetho_note_1',
   'trick_baetho_note_2',
   'trick_baetho_note_3',
   'trick_baetho_note_4',
   'trick_spare_override',
   'trick_clock_offset',
   'trick_voice_recording',
   'trick_stage_maintenance',
   'trick_tape_trace',
   'trick_camera_reflection',
   'trick_rehearsal_diary',
   'trick_safety_report',
   'trick_prop_invoice',
   'trick_reconstruction',
   'trick_evacuation_truth'
  ]),
  'cruel-heart-island':new Set([
   'minjae_rescue_ring',
   'minjae_first_aid',
   'minjae_old_photo',
   'minjae_tide_chart',
   'doyun_sponsor_contract',
   'doyun_drone_clip',
   'doyun_luxury_watch',
   'doyun_brand_badge',
   'seojun_wave_meter',
   'seojun_research_badge',
   'seojun_old_report',
   'seojun_dry_notebook',
   'taehan_old_warrant',
   'taehan_black_gloves',
   'taehan_shoe_sketch',
   'taehan_handcuffs',
   'harin_editor_pass',
   'harin_violet_ribbon',
   'harin_voice_draft',
   'harin_signal_flare',
   'yura_dance_shoes',
   'yura_couple_photo',
   'yura_diary',
   'yura_monitor_note',
   'nayeon_match_table',
   'nayeon_usb_backup',
   'nayeon_contract_copy',
   'nayeon_heart_chip',
   'somi_scripted_dates',
   'somi_rescue_net',
   'somi_family_letter',
   'somi_parting_note',
   'island_welcome',
   'island_cast_contract',
   'island_tide_warn',
   'island_sponsor_bill',
   'island_shoe_marks',
   'island_edit_room',
   'island_camera_lag',
   'island_early_message',
   'island_doctor_note',
   'island_drone_master',
   'island_net_box',
   'island_sound_test',
   'island_tide_gate',
   'island_duplicate_badge',
   'island_tide_autopsy',
   'island_last_intercom',
   'island_interview_raw',
   'island_relay_key',
   'island_sponsor_real',
   'island_tide_recheck',
   'island_ribbon_thread',
   'island_truth_contract',
   'island_final_cut',
   'island_escape_beacon'
  ]),
  'stellar-academy-first-case':new Set(["seoha_folded_map", "seoha_puzzle_ring", "seoha_safe_marker", "seoha_rescue_token", "taewon_mirror_box", "taewon_stage_rope", "taewon_voice_filter", "taewon_rented_prop", "yeonju_star_almanac", "yeonju_anonymous_chat", "yeonju_micro_scope", "yeonju_sky_photo", "jinwoo_rescue_helmet", "jinwoo_floor_plan", "jinwoo_failure_report", "jinwoo_emergency_radio", "rion_cipher_ledger", "rion_patron_letter", "rion_golden_dictionary", "rion_sealed_note", "gabin_voice_script", "gabin_stage_dart", "gabin_family_badge", "gabin_red_fiber", "academy_first_body", "academy_fake_sky", "academy_voice_witness", "academy_corridor_log", "academy_stage_loan", "academy_old_tunnel", "academy_message", "academy_support_funds", "academy_red_thread", "academy_secret_fund", "academy_safety_repeat", "academy_mock_exit", "academy_autopsy_time", "academy_voice_match", "academy_high_badge", "academy_deleted_phrase", "academy_projection_backup", "academy_early_signal", "academy_lock_token", "academy_escape_pass_card", "academy_admin_original", "academy_lost_student", "academy_culprit_chain", "academy_second_exit"]),
  'neon-memory-quarantine':new Set(["nova_memory_badge", "nova_shield_patch", "nova_empty_notebook", "nova_old_case_file", "rune_medical_scanner", "rune_revoked_license", "rune_old_consent", "rune_surgical_tablet", "ion_pulse_blade", "ion_maintenance_token", "ion_fake_warning", "ion_sibling_identity", "mira_legal_patch", "mira_ai_petition", "mira_shadow_receipt", "mira_identity_clause", "atlas_riot_shield", "atlas_old_access", "atlas_duty_log", "atlas_encrypted_message", "echo_shell_drive", "echo_ghost_key", "echo_emotion_log", "echo_backup_hash", "sol_courier_case", "sol_anon_invoice", "sol_radio_shell", "sol_immunity_paper", "memory_audit_letter", "memory_body_scan", "memory_echo_frame", "memory_emptied_chair", "memory_id_overlap", "memory_underground_bill", "memory_exmate_memo", "memory_legal_hold", "memory_emergency_log", "memory_coat_camera", "memory_voice_repeat", "memory_fake_patient", "memory_core_key", "memory_backup_before", "memory_ghost_sequence", "memory_implant_receipt", "memory_compromised_tag", "memory_ion_sibling", "memory_emp_order", "memory_core_backdoor", "memory_bio_echo", "memory_shutdown_map", "memory_security_ledger", "memory_culprit_reconstruction", "memory_original_rights", "memory_why_sealed"])
 };
 // All visuals for the Jeju scenario deliberately remain visible, asset-free
 // placeholders. A separate art agent can replace them later without changing
 // role/card IDs or exposing reverse-side evidence before research.
 const jejuTheme='jeju-lab-conference';
 function jejuDummy(kind,id,label,accent){
  const cover=kind==='cover',portrait=kind==='portrait';
  const w=cover?1024:portrait?360:460,h=cover?440:portrait?470:310;
  const css=cover?'mystery-story-cover':portrait?'mystery-portrait real-portrait mystery-placeholder-art':'mystery-clue-art mystery-placeholder-art';
  const base=/^#[0-9a-fA-F]{6}$/.test(accent||'')?accent:'#879fa8';
  const safeId=escape(String(id||'art-placeholder').slice(0,42));
  const safeLabel=escape(String(label||'시나리오 더미 이미지').slice(0,28));
  return '<svg class="'+css+'" data-placeholder="true" data-asset="'+safeId+
    '" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escape(String(label||'이미지 준비 중'))+
    ' · 이미지 제작 예정" xmlns="http://www.w3.org/2000/svg">'+
    '<rect width="'+w+'" height="'+h+'" rx="16" fill="#1a2a34"/>'+
    '<rect x="16" y="16" width="'+(w-32)+'" height="'+(h-32)+'" rx="11" fill="none" stroke="'+base+'" stroke-dasharray="9 8" stroke-width="3"/>'+
    '<circle cx="'+(w/2)+'" cy="'+(h/2-42)+'" r="'+(portrait?50:35)+'" fill="none" stroke="'+base+'" stroke-width="4"/>'+
    '<path d="M'+(w/2-22)+' '+(h/2-36)+'l16 14 31 -34" fill="none" stroke="'+base+'" stroke-width="4"/>'+
    '<text x="50%" y="'+(h/2+39)+'" font-size="'+(cover?31:portrait?19:22)+'" text-anchor="middle" fill="#e6e0d5" font-family="sans-serif">'+safeLabel+'</text>'+
    '<text x="50%" y="'+(h/2+70)+'" font-size="13" text-anchor="middle" fill="'+base+'" font-family="monospace">ART PLACEHOLDER · '+safeId+'</text></svg>';
 }
 const standaloneProps={'cruel-heart-island':new Set(['boat','cabinet','plant','fireplace','camera','terminal','sofa','table','wardrobe','fridge','generator','shelf','server']),'d1-crown-of-ashes':new Set(['sink','fridge','pc','gargoyle','throne','stove','table','camera','plant','desk','bed','cabinet','terminal','server','generator','statue']),'stellar-academy-first-case':new Set(['bed','cabinet','desk','shelf','telescope','projector','terminal','medical','door','generator']),'neon-memory-quarantine':new Set(['terminal','sofa','cabinet','camera','medical','pod','generator','server'])};
 const storyFor=id=>Object.hasOwn(A,id)?id:id==='d1-gaming'?'d1-crown-of-ashes':null;
 const knownStory=id=>A[storyFor(id)]||null;
 const independentNPCs={'cruel-heart-island':'wonjae','neon-memory-quarantine':'sera'};
 function standalonePortrait(story,id){
  const theme=storyFor(story),data=knownStory(story);
  if(!['d1-crown-of-ashes','cruel-heart-island','neon-memory-quarantine','stellar-academy-first-case'].includes(theme)||(!Object.hasOwn(data.portraits,id)&&independentNPCs[theme]!==id))return null;
  return {...data,file:'portraits/'+theme+'/'+id+'.webp',size:[432,576]};
 }
 function artCrop(story,rect,css,alt,data=knownStory(story)){
  if(!data||!rect)return null;
  const [x,y,w,h]=rect, [width,height]=data.size;
  // All geometry is from our internal atlas manifest, never raw user fields.
  return '<svg class="'+css+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escape(alt)+
    '" xmlns="http://www.w3.org/2000/svg" overflow="hidden">'+
    '<image href="'+path+data.file+'" x="'+(-x)+'" y="'+(-y)+'" width="'+width+
    '" height="'+height+'" preserveAspectRatio="none"/>'+
    '</svg>';
 }

 // Rebuild each portrait / evidence card as an original UI composition:
 // illustrated source as the subject, plus newly rendered stage, light, frame,
 // insignia and an item-specific evidence seal. This deliberately does not
 // present a naked crop of the concept sheet as the finished artwork.
 const hash=value=>{let h=2166136261;for(const ch of String(value)){
  h=Math.imul(h^ch.charCodeAt(0),16777619);}return h>>>0;};
 const shapeColor=(color,fallback)=>/^#[0-9a-fA-F]{6}$/.test(color||'')?color:fallback;
 const sourceImage=(data,rect,x,y,w,h)=>{
  const [sx,sy,sw,sh]=rect;
  return '<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+
   '" viewBox="0 0 '+sw+' '+sh+'" preserveAspectRatio="xMidYMid slice" overflow="hidden">'+
   '<image href="'+path+data.file+'" x="'+(-sx)+'" y="'+(-sy)+'" width="'+data.size[0]+
   '" height="'+data.size[1]+'"/></svg>';
 };
 function compose(story,rect,identifier,label,css,type,accent,data=knownStory(story)){
  if(!data||!rect)return null;
  const portraitMode=type==='portrait',w=portraitMode?360:460,h=portraitMode?470:310;
  const seed=hash(story+':'+identifier),name='art'+seed.toString(36);
  const main=shapeColor(accent,data.palette[1]),dark=data.palette[0];
  const ix=portraitMode?32:75,iy=portraitMode?26:25;
  const iw=portraitMode?296:310,ih=portraitMode?390:246;
  const initials=escape(String(identifier||'ART').toUpperCase().replace(/[^A-Z0-9_\\-]/g,'').slice(0,17));
  const title=escape(String(label||'UNKNOWN').slice(0,18));
  const rings=Array.from({length:7},(_,i)=>{
   const x=18+((seed>>((i%4)*7))%320),y=28+(i*61)%h;
   return '<circle cx="'+x+'" cy="'+y+'" r="'+(2+i%3)+'" fill="'+main+'" opacity=".32"/>';
  }).join('');
  const ruled=Array.from({length:portraitMode?11:7},(_,i)=>{
   const x=12+i*33,y=h-31-(i%3)*4;
   return '<rect x="'+x+'" y="'+y+'" width="'+(12+i%4*4)+'" height="1" fill="'+main+'" opacity=".38"/>';
  }).join('');
  return '<svg class="'+css+' composed-mystery-art" data-asset="'+escape(String(identifier))+
   '" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+escape(label)+'"'+
   ' xmlns="http://www.w3.org/2000/svg" overflow="hidden">'+
   '<defs><linearGradient id="'+name+'bg" x2="1" y2="1"><stop stop-color="'+dark+
   '"/><stop offset=".5" stop-color="#20223c"/><stop offset="1" stop-color="'+dark+'"/></linearGradient>'+
   '<radialGradient id="'+name+'gl"><stop stop-color="'+main+'" stop-opacity=".65"/>'+
   '<stop offset="1" stop-color="'+main+'" stop-opacity="0"/></radialGradient>'+
   '<linearGradient id="'+name+'veil" x1="0" y1="0" x2="0" y2="1">'+
   '<stop offset="0" stop-color="'+dark+'" stop-opacity="0"/>'+
   '<stop offset=".7" stop-color="'+dark+'" stop-opacity=".08"/>'+
   '<stop offset="1" stop-color="'+dark+'" stop-opacity=".97"/></linearGradient>'+
   '<clipPath id="'+name+'clip"><rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" rx="'+
   (portraitMode?22:16)+'"/></clipPath></defs>'+
   '<rect width="'+w+'" height="'+h+'" rx="18" fill="url(#'+name+'bg)"/>'+
   '<circle cx="'+(seed%w)+'" cy="'+(seed%h)+'" r="'+(portraitMode?260:210)+
   '" fill="url(#'+name+'gl)"/>'+
   '<g opacity=".2" transform="translate(-65,-40)">'+sourceImage(data,rect,0,0,w+130,h+90)+'</g>'+
   '<g clip-path="url(#'+name+'clip)">'+
   '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="'+dark+'"/>'+
   sourceImage(data,rect,ix,iy,iw,ih)+
   '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="url(#'+name+'veil)"/></g>'+
   '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" rx="'+(portraitMode?22:16)+
   '" fill="none" stroke="'+main+'" stroke-opacity=".75" stroke-width="2"/>'+
   '<rect x="9" y="9" width="'+(w-18)+'" height="'+(h-18)+
   '" rx="15" fill="none" stroke="'+main+'" stroke-opacity=".45"/>'+
   '<circle cx="'+(w-33)+'" cy="32" r="12" fill="none" stroke="'+main+'" stroke-width="1.2"/>'+
   '<circle cx="'+(w-33)+'" cy="32" r="4" fill="'+main+'"/>'+
   rings+ruled+
   '<rect x="24" y="'+(h-65)+'" width="'+(w-48)+'" height="43" rx="8" fill="'+dark+
   '" fill-opacity=".9" stroke="'+main+'" stroke-opacity=".58"/>'+
   '<text x="36" y="'+(h-46)+'" fill="'+main+
   '" font-family="sans-serif" font-size="10" letter-spacing="2">'+
   (portraitMode?'PERSONNEL DOSSIER':'EVIDENCE RECORD')+' · '+String(seed%99).padStart(2,'0')+'</text>'+
   '<text x="36" y="'+(h-32)+'" fill="#f2e8df" font-family="sans-serif" font-size="'+
   (portraitMode?12:13)+'" font-weight="600">'+(portraitMode?title:initials)+'</text></svg>';
 }
 function portrait(c,story,small=false){
  if(story===jejuTheme)return jejuDummy('portrait',c?.id,c?.name,c?.accent);
  const asset=standalonePortrait(story,c?.id);
  const css='mystery-portrait real-portrait'+(small?' portrait-compact':'');
  if(asset)return compose(story,[0,0,...asset.size],c.id,c.name+' 캐릭터 초상화',css,'portrait',c.accent,asset);
  const data=knownStory(story);
  const rect=data?.portraits?.[c?.id];
  // The dating and neon reference sheets present seven/eight figures in a
  // narrow single row. Zoom to their illustrated heads and shoulders, not
  // the empty lower part of each full sheet cell.
  const focused=rect&&['cruel-heart-island','neon-memory-quarantine'].includes(story)
    ?[rect[0],rect[1]+10,rect[2],Math.min(rect[3]-10,204)]:rect;
  if(focused)return compose(story,focused,c.id,c.name+' 캐릭터 초상화',
   css,'portrait',c.accent);
  return '<span class="mystery-unillustrated">'+escape(c?.symbol||'♟')+'</span>';
 }
 function clueKind(card,story){
  const text=(card?.title||card?.name||'')+' '+(card?.subtitle||'')+' '+(card?.id||'');
  if(story==='d1-crown-of-ashes'||story==='d1-gaming'){
   if(/식칼|식칼|cleaver|knife|오염된 대형/.test(text))return 'knife';
   if(/미니어처|미니어쳐|mini_gargoyle/.test(text))return 'mini';
   if(/가고일.*노트|가고일.*교리|종교 노트|cult|교단|종교/.test(text))return 'cultbook';
   if(/알파카|털뭉치|alpaca|furry/.test(text))return 'furry';
   if(/태그|출입|관리자|badge|access|카드키/.test(text))return 'badge';
   if(/배익호.*노트|왕좌|원고|노트|메모|일지|수첩|비법/.test(text))return 'note';
   return 'note';
  }
  if(story==='cruel-heart-island'){
   if(/드론|drone|메모리.*카드/.test(text))return 'drone';
   if(/신발|운동화|발자국|shoes/.test(text))return 'shoes';
   if(/백업|알고리즘|USB|매칭|drive|추천/.test(text))return 'drive';
   if(/면담|인터뷰|원본|음성|태블릿|video|녹화/.test(text))return 'interview';
   if(/조수|관측|경고|타이머|수위|전력/.test(text))return 'warning';
   return 'contract';
  }
  if(story==='neon-memory-quarantine'){
   if(/신분|메모리 칩|칩|chip|기억/.test(text))return 'chip';
   if(/의료|생체|진료|스캐너|medical|병원|시신/.test(text))return 'medical';
   if(/물류|운송|케이스|배송|cargo|case/.test(text))return 'case';
   if(/계약|법률|불법|identity|동의서|서류/.test(text))return 'contract';
   if(/토큰|승인|정비|태그|출입|badge/.test(text))return 'token';
   return 'audit';
  }
  if(story==='stellar-academy-first-case'){
   if(/암호|쪽지|퍼즐|cipher|map|약도/.test(text))return 'cipher';
   if(/일지|별자리|기록|관측|연감|star/.test(text))return 'diary';
   if(/음성|공연|필터|마술|녹음|무전|audio/.test(text))return 'audio';
   if(/출입 배지|badge|학생증|출입증/.test(text))return 'badge';
   if(/탈출|출구|인증서|exit/.test(text))return 'exit';
   return 'experiment';
  }
  return null;
 }
 function clue(c,story){
  if(story===jejuTheme)return jejuDummy('clue',c?.cardId||c?.id,c?.title||c?.name);
  const theme=storyFor(story),data=knownStory(story),label=c?.title||c?.name||'조사 카드';
  const cardId=c?.cardId||c?.id;
  if(individualClues[theme]?.has(cardId)){
   const asset={...data,file:'clues/'+theme+'/'+cardId+'.webp',size:[512,512]};
   // Evidence details at the edges must remain visible in every UI size.
   return '<svg class="mystery-clue-art real-clue-art standalone-evidence"'+
    ' data-asset="'+escape(cardId)+'" viewBox="0 0 512 512"'+
    ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+escape(label)+'"'+
    ' xmlns="http://www.w3.org/2000/svg"><desc>EVIDENCE RECORD</desc>'+
    '<image href="'+path+asset.file+'" width="512" height="512"'+
    ' preserveAspectRatio="xMidYMid meet"/></svg>';
  }
  const key=clueKind(c,theme),rect=data?.clues?.[key];
  if(rect)return compose(story,rect,c?.id||c?.title||c?.name||key,label,
    'mystery-clue-art real-clue-art','evidence',null);
  return '<span class="mystery-unillustrated mystery-clue-placeholder">✧</span>';
 }
 function object(o,story){
  const theme=storyFor(story),data=knownStory(story);
  if(standaloneProps[theme]?.has(o?.kind)){
   const asset={...data,file:'props/'+theme+'/'+o.kind+'.webp',size:[384,384]};
   return artCrop(theme,[0,0,...asset.size],'mystery-map-object real-map-object',o.name||o.kind,asset);
  }
  const rect=data?.objects?.[o?.kind];
  if(rect)return artCrop(story,rect,'mystery-map-object real-map-object',o?.name||o?.kind||'장식');
  // For custom/legacy maps whose authors entered an emoji, display that.
  return '<span class="map-prop-icon" aria-hidden="true">'+escape(o?.icon||'✧')+'</span>';
 }
 const independentNavigation=new Set(['d1-crown-of-ashes','stellar-academy-first-case','cruel-heart-island','neon-memory-quarantine']);
 function navigationAsset(story,key,css,label){
  const theme=storyFor(story),data=knownStory(story);
  if(!independentNavigation.has(theme))return null;
  return artCrop(story,[0,0,384,384],css,label,
   {...data,file:'navigation/'+theme+'/'+key+'.webp',size:[384,384]});
 }
 function door(d,story){
  const data=knownStory(story);
  const kind=d?.locked?'locked':d?.open?'open':'closed';
  const independent=navigationAsset(story,'door-'+kind,'mystery-door-art',d?.name||'문');
  if(independent)return independent;
  const rect=data?.doors?.[kind];
  return rect?artCrop(story,rect,'mystery-door-art',d?.name||'문'):null;
 }
 function stairs(portal,story){
  const data=knownStory(story);
  if(!data)return null;
  const down=/아래|내려|down|지하/i.test(portal?.label||'');
  const key=down?'down':'up';
  const independent=navigationAsset(story,'stairs-'+key,'mystery-stair-art',portal?.label||'층 이동');
  if(independent)return independent;
  return artCrop(story,data.stairs[key],'mystery-stair-art',portal?.label||'층 이동');
 }
 function cover(story){
  if(story===jejuTheme)return jejuDummy('cover','jeju-lab-cover','제주 학회 MT · 이미지 준비 중');
  const data=knownStory(story);
  if(!data)return null;
  const file=data.file.replace('.webp','-background.webp');
  return '<svg class="mystery-story-cover" viewBox="0 0 1024 440" role="img" aria-label="시나리오 배경 일러스트"'+
    ' preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">'+
    '<image href="'+path+'backgrounds/'+file+'" width="1024" height="440" preserveAspectRatio="xMidYMid slice"/></svg>';
 }
 function avatar(c,story){
  const asset=standalonePortrait(story,c?.characterId);
  if(asset)return artCrop(story,[86,38,270,270],'mystery-avatar-art',c.name+' 미니 아바타',asset);
  const data=knownStory(story);
  const rect=data?.portraits?.[c?.characterId];
  if(!rect)return null;
  const [x,y,w,h]=rect;
  // Head crop within portrait: recognizable at 20-25px on the shared map.
  const face=[x+Math.round(w*.2),y+Math.round(h*.13),Math.round(w*.62),Math.round(h*.59)];
  return artCrop(story,face,'mystery-avatar-art',c.name+' 미니 아바타');
 }
 function victim(story){
  const c=story?.victim,theme=story?.artTheme||story?.id;
  if(theme===jejuTheme&&c)return '<figure class="mystery-victim">'+jejuDummy('portrait',c.id,c.name)+
    '<figcaption><small>피해자 · NPC</small><b>'+escape(c.name)+'</b></figcaption></figure>';
  if(!c||!standalonePortrait(theme,c.id))return '';
  return '<figure class="mystery-victim">'+portrait(c,theme,true)+
   '<figcaption><small>피해자 · NPC</small><b>'+escape(c.name)+'</b></figcaption></figure>';
 }
 return {portrait,victim,clue,object,door,stairs,avatar,cover,clueKind,artCrop,atlas:A};
})();
