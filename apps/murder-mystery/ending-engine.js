'use strict';
/*
 * Read-only ending resolution shared by live rooms and studio test sessions.
 * No hidden author guides, culprit flags or other character secrets are sent
 * before the actual ending stage. Goals are assessed by the host manually.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MysteryEnding=api;
})(typeof window!=='undefined'?window:null,function(){
  const text=(x)=>typeof x==='string'?x:'';
  const unique=xs=>[...new Set(xs||[])];
  const outcome=(story,game,verdict,body,roleId)=>{
    const roles=story.characters||[],culprit=roles.find(c=>game.booklets?.[c.id]?.culprit);
    const chosen=roles.find(c=>c.id===verdict?.arrestedCharacterId)||null;
    const statuses=body||{},dead=unique(statuses.dead),restrained=unique(statuses.restrained),escaped=unique(statuses.escaped);
    // A deceased suspect cannot be physically arrested. Treat old room saves
    // with a stale dead+arrest combination as unresolved, never as a conviction.
    const caught=!!culprit&&!!chosen&&chosen.id===culprit.id&&!dead.includes(chosen.id);
    const verdictType=caught?'captured':chosen&&!dead.includes(chosen.id)?'wrongful':'unresolved';
    const cfg=game.ending||{},common=cfg.common||{};
    const shared=caught?common.captured:common.missed;
    const fallback=caught?'사건의 진상을 밝히다':'진범을 놓친 밤';
    const global={
      title:text(shared?.title)||fallback,
      paragraphs:(Array.isArray(shared?.paragraphs)?shared.paragraphs:[]).filter(Boolean),
      captured:caught,
      verdictType,
      arrestedCharacterId:dead.includes(chosen?.id)?null:chosen?.id||null,
      arrestedName:chosen?.name||null,
      culpritName:culprit?.name||null
    };
    if(!global.paragraphs.length)global.paragraphs=[
      caught?'수집한 증거와 증언이 맞물려 진범이 구속되었다. 사건의 진실이 밝혀지자 긴 밤은 끝을 맺었다.':
        chosen?'사람들은 '+chosen.name+'을 구속했지만 그것은 사건의 정답이 아니었다. 진범의 발자국은 여전히 밤 속에 남았다.':
          '아무도 진범을 구속하지 못했다. 모두가 떠나는 발소리 사이로 사건의 의문만 남았다.'
    ];
    if(verdictType==='wrongful'){
      global.paragraphs.push(chosen.name+'이(가) 구속되었다. 그러나 구속된 인물과 진범은 달랐다. 진실이 밝혀지는 날까지 억울한 혐의를 바로잡아야 한다.');
    }else if(verdictType==='unresolved'){
      global.paragraphs.push('그날 밤 누구도 진범으로 구속되지 않았다. 사건 기록은 미해결이라는 이름으로 봉인되었다.');
    }
    if(cfg.escape && Array.isArray((escaped.length?cfg.escape.succeeded:cfg.escape.failed)?.paragraphs)){
      global.paragraphs.push(...(escaped.length?cfg.escape.succeeded:cfg.escape.failed).paragraphs);
    }
    const character=roles.find(c=>c.id===roleId)||null;
    if(!character)return {common:global,personal:null};
    const cid=character.id,book=game.booklets?.[cid]||{},c=cfg.characters?.[cid]||{};
    const status=dead.includes(cid)?'dead':chosen?.id===cid?'arrested':
      restrained.includes(cid)?'restrained':escaped.includes(cid)?'escaped':'alive';
    const goal=verdict?.goals?.[cid];
    const goalMet=goal===true?true:goal===false?false:null;
    const isCulprit=!!book.culprit;
    const theme=text(c[caught?'captured':'missed'])||
      (caught?(isCulprit?'당신의 범행이 드러났다.':'당신은 진범이 구속되는 장면을 보았다.'):
        (isCulprit?'진범으로 지목되지 않은 당신은 한순간 안도했다.':'진범은 아직 밝혀지지 않았다.'));
    const statusDefault={
      dead:'당신의 이야기는 그날 밤 중단되었다. 남은 사람들은 당신이 남긴 증언과 선택을 되짚었다.',
      arrested:'구속된 당신은 다른 사람들의 눈앞에서 마지막 진술을 해야 했다.',
      restrained:'제압당한 당신은 사건의 마지막 순간에 행동할 자유를 잃었다.',
      escaped:'마침내 건물 밖으로 나왔지만, 이 사건을 잊을 수는 없었다.',
      alive:'당신은 끝까지 살아남아 자신이 지키려 했던 것을 다시 마주했다.'
    };
    const goalDefault=goalMet===true?'당신은 자신에게 부여된 개인 목표를 이루었다.':
      goalMet===false?'당신은 자신에게 부여된 개인 목표를 끝내 이루지 못했다.':
      '개인 목표의 달성 여부는 아직 판정되지 않았다. 진행자가 최종 결과를 확정해야 한다.';
    const paragraphs=[
      text(c.intro)||character.name+'에게 그날의 사건은 끝나지 않은 질문이었다.',
      theme,
      text(c[status])||statusDefault[status],
      goalMet===true?text(c.goalAchieved)||goalDefault:goalMet===false?
        text(c.goalFailed)||goalDefault:goalDefault,
      text(c.closing)||'당신의 이야기는 이 결말 이후에도 이어진다.'
    ].filter(Boolean);
    return {common:global,personal:{
      characterId:cid,name:character.name,title:character.name+'의 마지막 장',
      status,goalMet,goalText:text(book.objectives),isCulprit,verdictType,paragraphs
    }};
  };
  const summary=(story,game,verdict,body,viewerId,isHost)=>{
    const result=outcome(story,game,verdict,body,viewerId);
    if(!isHost)return result;
    result.editor={
      arrestedCharacterId:verdict?.arrestedCharacterId||null,
      goals:Object.fromEntries((story.characters||[]).map(c=>[c.id,
        verdict?.goals?.[c.id]===true?true:verdict?.goals?.[c.id]===false?false:null])),
      characters:(story.characters||[]).map(c=>({
        id:c.id,name:c.name,goalMet:verdict?.goals?.[c.id]===true?true:
          verdict?.goals?.[c.id]===false?false:null,
        dead:(body?.dead||[]).includes(c.id),restrained:(body?.restrained||[]).includes(c.id),
        escaped:(body?.escaped||[]).includes(c.id),
        override:verdict?.statuses?.[c.id]||'auto'
      }))
    };
    return result;
  };
  return {outcome,summary};
});
