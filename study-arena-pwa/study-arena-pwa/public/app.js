import { firebaseConfig } from '/firebase-config.js';

const $ = (id) => document.getElementById(id);
const TODAY = localDateKey(new Date());
const TARGET_MINUTES = 240;
const SUBJECTS = [
  {name:'Mathematics',icon:'∑',tint:'#6de4dc',bg:'#183b42'},
  {name:'Science',icon:'⚛',tint:'#aa96ff',bg:'#30264d'},
  {name:'Social Science',icon:'◎',tint:'#ffbd78',bg:'#493522'},
  {name:'Hindi',icon:'अ',tint:'#ff9fbd',bg:'#46283a'},
  {name:'English',icon:'Aa',tint:'#8eb5ff',bg:'#233452'},
  {name:'Sanskrit',icon:'ॐ',tint:'#8ee0a8',bg:'#203c32'}
];
const CHAPTERS = [
  {subject:'Mathematics',items:['Propositions and Their Converses','Understanding Data','The World of Algorithms','Quadrilaterals','Two Variables, One Line','Surface Area and Volume']},
  {subject:'Science',items:['Reproduction: How Life Continues','Patterns in Life','Journey Inside the Atom','Atomic Foundations of Matter','Work, Energy and Simple Machines','Sound Waves']},
  {subject:'Social Science',items:['Oceans and Life','Life on Earth','Resistance and Resilience','India and the World-I','Authority','From Ideas to Startups','Smart Ways to Manage Your Finances']},
  {subject:'Hindi',items:['आखिरी चट्टान तक','रीढ़ की हड्डी','मैं और मेरा देश','झाँसी की रानी','घर की याद','व्याकरण और लेखन']},
  {subject:'English',items:['The World of Limitless Possibilities','Twin Melodies','Carrier of Words','Follow That Dream','Nine Gold Medals','A Friend Found in Music','Words','Believe in Yourself','Grammar and Writing']},
  {subject:'Sanskrit',items:['Post-mid-term lessons 6–11','Sandhi and Samas','Shabd Roop and Dhatu Roop','Pratyay and grammar']}
];
const $allChapters = CHAPTERS.flatMap(group=>group.items.map((title,index)=>({id:slug(`${group.subject}-${index}-${title}`),subject:group.subject,title})));
let state = {profile:null,logs:[],leaderboard:[],completed:[],uid:null,mode:'local',unsubscribeBoard:null,unsubscribeLogs:null,installPrompt:null};
let fb = null;

function localDateKey(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function safeName(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function weekStart(dateKey){const d=new Date(`${dateKey}T12:00:00`);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return localDateKey(d)}
function daysBetween(a,b){return Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)}
function formatDate(k){return new Date(`${k}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600)}
function showModal(id){$(id).classList.add('show')}
function closeModal(id){$(id).classList.remove('show')}
function isFirebaseConfigured(){return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_') && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith('YOUR_') && firebaseConfig.appId && !firebaseConfig.appId.startsWith('YOUR_')}
function getLocal(){try{return JSON.parse(localStorage.getItem('studyArena_v1')||'{}')}catch{return {}}}
function setLocal(data){localStorage.setItem('studyArena_v1',JSON.stringify(data))}
function blankProfile(username,uid='local-user'){return {uid,username,displayName:username,totalMinutes:0,totalPoints:0,streak:0,studyDays:0,chaptersCompleted:0,sessionsCompleted:0,weeklyMinutes:0,weekStart:weekStart(TODAY),lastStudyDate:'',completedChapterIds:[],updatedAt:Date.now()}}
function setConnection(label,live){$('connectionLabel').textContent=label;$('syncFoot').textContent=label;document.querySelector('.status-pip').style.background=live?'#57dda6':'#ffb76b'}

async function initFirebase(){
  if(!isFirebaseConfigured())return false;
  try{
    const [{initializeApp},{getAuth,signInAnonymously,onAuthStateChanged},{getFirestore}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js')
    ]);
    const app=initializeApp(firebaseConfig);const auth=getAuth(app);const db=getFirestore(app);
    const fs=await import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js');
    fb={auth,db,signInAnonymously,onAuthStateChanged,...fs};
    await new Promise((resolve,reject)=>{
      const unsub=onAuthStateChanged(auth,async user=>{
        if(user){unsub();state.uid=user.uid;state.mode='live';resolve()}
        else{try{await signInAnonymously(auth)}catch(e){unsub();reject(e)}}
      },err=>{unsub();reject(err)});
    });
    const profileRef=fb.doc(db,'profiles',state.uid);const snap=await fb.getDoc(profileRef);
    if(snap.exists()){
      state.profile={...snap.data(),uid:state.uid};state.completed=state.profile.completedChapterIds||[];
      setConnection('Live sync connected',true);subscribeLive();
    }else{
      setConnection('Live · choose a username',true);showModal('profileModal');
    }
    return true;
  }catch(error){console.error('Firebase init failed',error);setConnection('Offline / local preview',false);toast('Live sync unavailable. Check Firebase setup.');return false}
}

function subscribeLive(){
  if(!fb||!state.uid)return;
  if(state.unsubscribeBoard)state.unsubscribeBoard();
  const boardQ=fb.query(fb.collection(fb.db,'profiles'),fb.orderBy('totalPoints','desc'),fb.limit(50));
  state.unsubscribeBoard=fb.onSnapshot(boardQ,snap=>{state.leaderboard=snap.docs.map(d=>d.data());renderLeaderboard();},err=>{console.error(err);toast('Leaderboard sync issue')});
  loadOwnLogs();
}
function loadOwnLogs(){
  if(!fb||!state.uid)return;
  if(state.unsubscribeLogs)state.unsubscribeLogs();
  const q=fb.query(fb.collection(fb.db,'dailyLogs'),fb.where('uid','==',state.uid),fb.orderBy('date','desc'),fb.limit(60));
  state.unsubscribeLogs=fb.onSnapshot(q,snap=>{state.logs=snap.docs.map(d=>d.data());renderAll()},err=>{console.error(err);toast('Study history could not sync')});
}

async function claimUsername(){
  const raw=$('usernameInput').value.trim();const username=raw.toLowerCase();
  if(!/^[a-z0-9_]{3,18}$/.test(username)){$('profileError').textContent='Use 3–18 letters, numbers, or underscores.';return}
  $('claimUsernameBtn').disabled=true;$('profileError').textContent='';
  try{
    if(state.mode==='live'&&fb){
      const usernameRef=fb.doc(fb.db,'usernames',username);const profileRef=fb.doc(fb.db,'profiles',state.uid);
      await fb.runTransaction(fb.db,async tx=>{
        const existing=await tx.get(usernameRef);if(existing.exists()&&existing.data().uid!==state.uid)throw new Error('That username is already taken. Try another.');
        const profileSnap=await tx.get(profileRef);if(profileSnap.exists())throw new Error('This account already has a profile. Refresh the page.');
        const profile=blankProfile(username,state.uid);
        tx.set(usernameRef,{uid:state.uid,username,createdAt:fb.serverTimestamp()});
        tx.set(profileRef,{...profile,createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});
      });
      const snap=await fb.getDoc(profileRef);state.profile=snap.data();state.completed=state.profile.completedChapterIds||[];closeModal('profileModal');setConnection('Live sync connected',true);subscribeLive();renderAll();toast(`Welcome to the arena, @${username}!`);
    }else{
      const data=getLocal();if(data.profile&&data.profile.username!==username){$('profileError').textContent='A profile already exists in this browser. Use that username.';return}
      state.profile=data.profile||blankProfile(username);state.logs=data.logs||[];state.completed=data.completed||[];data.profile=state.profile;setLocal(data);closeModal('profileModal');setConnection('Local preview · Firebase not connected',false);renderAll();toast(`Welcome, @${username}! Local preview mode.`);
    }
  }catch(e){$('profileError').textContent=e.message||'Could not create your profile.'}
  finally{$('claimUsernameBtn').disabled=false}
}

function computePoints(minutes,tasks,chapters){return Math.floor(minutes/15)+tasks*5+chapters*20}
async function saveStudyLog(){
  if(!state.profile){showModal('profileModal');return}
  const date=$('logDate').value||TODAY;const subject=$('logSubject').value;const session=Number($('logSession').value);const minutes=Number($('logMinutes').value);const topic=$('logTopic').value.trim();const tasks=Math.max(0,Math.min(30,Number($('logTasks').value)||0));const chapters=Math.max(0,Math.min(10,Number($('logChapters').value)||0));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>TODAY){$('logError').textContent='Choose a valid date that is not in the future.';return}
  if(!Number.isFinite(minutes)||minutes<5||minutes>240){$('logError').textContent='Enter study time between 5 and 240 minutes.';return}
  if(topic.length>90){$('logError').textContent='Topic must be 90 characters or fewer.';return}
  $('saveLogBtn').disabled=true;$('logError').textContent='';
  const sessionKey=`session${session}`;
  const sessionData={subject,topic,minutes,tasks,chapters,points:computePoints(minutes,tasks,chapters)};
  try{
    if(state.mode==='live'&&fb){
      const logRef=fb.doc(fb.db,'dailyLogs',`${state.uid}_${date}`);const profileRef=fb.doc(fb.db,'profiles',state.uid);
      await fb.runTransaction(fb.db,async tx=>{
        const [logSnap,profileSnap]=await Promise.all([tx.get(logRef),tx.get(profileRef)]);
        if(!profileSnap.exists())throw new Error('Profile not found. Refresh and try again.');
        const old=logSnap.exists()?logSnap.data():{totalMinutes:0,totalPoints:0,tasksCompleted:0,chaptersCompleted:0,sessionsCompleted:0};
        const oldSession=old[sessionKey]||{minutes:0,tasks:0,chapters:0,points:0};
        const deltaMinutes=minutes-(oldSession.minutes||0);const deltaPoints=sessionData.points-(oldSession.points||0);
        const hasNewSession=(oldSession.minutes||0)===0;
        const profile=profileSnap.data();const currentWeek=weekStart(date);let weeklyMinutes=profile.weekStart===currentWeek?(profile.weeklyMinutes||0):0;
        weeklyMinutes+=deltaMinutes;
        let streak=profile.streak||0;let lastStudyDate=profile.lastStudyDate||'';let studyDays=profile.studyDays||0;
        if((old.totalMinutes||0)===0){studyDays+=1;if(!lastStudyDate||date>lastStudyDate){streak=lastStudyDate&&daysBetween(lastStudyDate,date)===1?streak+1:1;lastStudyDate=date}}
        const nextLog={...old,uid:state.uid,username:profile.username,date,[sessionKey]:sessionData,totalMinutes:(old.totalMinutes||0)+deltaMinutes,totalPoints:(old.totalPoints||0)+deltaPoints,tasksCompleted:(old.tasksCompleted||0)+tasks-(oldSession.tasks||0),chaptersCompleted:(old.chaptersCompleted||0)+chapters-(oldSession.chapters||0),sessionsCompleted:(old.sessionsCompleted||0)+(hasNewSession?1:0),updatedAt:fb.serverTimestamp()};
        tx.set(logRef,nextLog);
        tx.update(profileRef,{totalMinutes:Math.max(0,(profile.totalMinutes||0)+deltaMinutes),totalPoints:Math.max(0,(profile.totalPoints||0)+deltaPoints),chaptersCompleted:Math.max(0,(profile.chaptersCompleted||0)+chapters-(oldSession.chapters||0)),sessionsCompleted:(profile.sessionsCompleted||0)+(hasNewSession?1:0),studyDays,streak,lastStudyDate,weeklyMinutes:Math.max(0,weeklyMinutes),weekStart:currentWeek,updatedAt:fb.serverTimestamp()});
      });
      closeModal('logModal');$('logMinutes').value='';$('logTopic').value='';$('logTasks').value='0';$('logChapters').value='0';toast('Session saved · your arena stats are syncing live.');
    }else{
      const data=getLocal();let log=state.logs.find(x=>x.date===date)||{uid:'local-user',username:state.profile.username,date,totalMinutes:0,totalPoints:0,tasksCompleted:0,chaptersCompleted:0,sessionsCompleted:0};
      const old=log[sessionKey]||{minutes:0,tasks:0,chapters:0,points:0};const deltaMinutes=minutes-old.minutes;const deltaPoints=sessionData.points-old.points;const hasNew=old.minutes===0;
      log={...log,[sessionKey]:sessionData,totalMinutes:log.totalMinutes+deltaMinutes,totalPoints:log.totalPoints+deltaPoints,tasksCompleted:log.tasksCompleted+tasks-old.tasks,chaptersCompleted:log.chaptersCompleted+chapters-old.chapters,sessionsCompleted:log.sessionsCompleted+(hasNew?1:0)};
      state.logs=state.logs.filter(x=>x.date!==date).concat(log).sort((a,b)=>b.date.localeCompare(a.date));
      const p=state.profile;p.totalMinutes=Math.max(0,p.totalMinutes+deltaMinutes);p.totalPoints=Math.max(0,p.totalPoints+deltaPoints);p.chaptersCompleted=Math.max(0,p.chaptersCompleted+chapters-old.chapters);p.sessionsCompleted+=hasNew?1:0;
      if(!data.logs?.some(x=>x.date===date)){p.studyDays++;if(!p.lastStudyDate||date>p.lastStudyDate){p.streak=p.lastStudyDate&&daysBetween(p.lastStudyDate,date)===1?p.streak+1:1;p.lastStudyDate=date}}
      p.weeklyMinutes=(p.weekStart===weekStart(date)?p.weeklyMinutes:0)+deltaMinutes;p.weekStart=weekStart(date);p.updatedAt=Date.now();
      data.profile=p;data.logs=state.logs;data.completed=state.completed;setLocal(data);closeModal('logModal');renderAll();toast('Session saved on this device. Connect Firebase for live sharing.');
    }
  }catch(e){$('logError').textContent=e.message||'Could not save this session.'}
  finally{$('saveLogBtn').disabled=false}
}

async function toggleChapter(id,checked){
  const next=checked?[...new Set([...state.completed,id])]:state.completed.filter(x=>x!==id);state.completed=next;
  if(state.mode==='live'&&fb&&state.uid){try{await fb.updateDoc(fb.doc(fb.db,'profiles',state.uid),{completedChapterIds:next,chaptersCompleted:next.length,updatedAt:fb.serverTimestamp()})}catch(e){console.error(e);toast('Could not sync chapter progress')}}else{const data=getLocal();data.completed=next;if(data.profile){data.profile.completedChapterIds=next;data.profile.chaptersCompleted=next.length}setLocal(data)}
  renderSyllabus();renderSubjectCards();$('chaptersDone').textContent=state.profile?.chaptersCompleted||next.length;
}

function currentTodayLog(){return state.logs.find(x=>x.date===TODAY)||{totalMinutes:0,session1:{minutes:0},session2:{minutes:0}}}
function renderAll(){renderOverview();renderProgress();renderLeaderboard();renderActivity();renderSyllabus();renderSubjectCards();if(state.profile){$('headerUsername').textContent='@'+state.profile.username;$('avatarInitial').textContent=state.profile.username.charAt(0).toUpperCase()}}
function renderOverview(){
  const p=state.profile||blankProfile('student');const log=currentTodayLog();const minutes=log.totalMinutes||0;const pct=Math.min(100,minutes/ TARGET_MINUTES*100);const s1=log.session1?.minutes||0;const s2=log.session2?.minutes||0;
  $('todayHours').textContent=(minutes/60).toFixed(1);$('todayPercent').textContent=`${Math.round(pct)}%`;$('todayRemaining').textContent=minutes>=240?'Daily target achieved':`${((240-minutes)/60).toFixed(1)} hours to go`;$('todayMeter').style.width=`${pct}%`;
  $('totalXP').textContent=(p.totalPoints||0).toLocaleString();$('streak').textContent=p.streak||0;$('chaptersDone').textContent=p.chaptersCompleted||0;
  $('ringPercent').textContent=`${Math.round(pct)}%`;$('dailyRing').style.background=`conic-gradient(#66e7df 0%,#9b86ff ${pct}%,#26324b ${pct}%,#26324b 100%)`;
  $('sessionOneStatus').textContent=`${(s1/60).toFixed(1)} / 2 hrs`;$('sessionTwoStatus').textContent=`${(s2/60).toFixed(1)} / 2 hrs`;$('sessionOneMeter').style.width=`${Math.min(100,s1/120*100)}%`;$('sessionTwoMeter').style.width=`${Math.min(100,s2/120*100)}%`;
  $('missionHeadline').textContent=minutes>=240?'Daily mission complete.':minutes>0?'Nice progress. Keep your focus.':'Your next win is waiting.';$('missionSub').textContent=minutes>=240?'You hit your 4-hour target. Consistency is built one day at a time.':`${(Math.max(0,240-minutes)/60).toFixed(1)} focused hours left in today's mission.`;
  const wk=weekStart(TODAY);const weekly=state.logs.filter(x=>x.date>=wk&&x.date<=TODAY).reduce((a,x)=>a+(x.totalMinutes||0),0);$('weekTotal').innerHTML=`${(weekly/60).toFixed(1)}h <small>/ 28h</small>`;$('weekTargetText').textContent=`${Math.round(Math.min(100,weekly/1680*100))}% of weekly goal`;
  $('todayLabel').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}).toUpperCase();renderWeekChart();
}
function renderWeekChart(){const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];const now=new Date(`${TODAY}T12:00:00`);const monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));let html='';labels.forEach((label,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);const key=localDateKey(day);const log=state.logs.find(x=>x.date===key);const hrs=(log?.totalMinutes||0)/60;const height=Math.max(3,Math.min(100,hrs/4*100));html+=`<div class="chart-col"><span class="chart-value">${hrs?hrs.toFixed(1)+'h':'—'}</span><div class="chart-bar" style="height:${height}%"></div><span class="chart-day">${label}</span></div>`});$('weekChart').innerHTML=html}
function renderSubjectCards(){let html='';SUBJECTS.forEach(s=>{const minutes=state.logs.reduce((sum,l)=>sum+((l.session1?.subject===s.name?l.session1.minutes:0)+(l.session2?.subject===s.name?l.session2.minutes:0)),0);const chapDone=state.completed.filter(id=>$allChapters.find(c=>c.id===id)?.subject===s.name).length;const total=CHAPTERS.find(c=>c.subject===s.name)?.items.length||0;const pct=total?Math.round(chapDone/total*100):0;html+=`<article class="subject-card"><div class="subject-top"><span class="subject-icon" style="color:${s.tint};background:${s.bg}">${s.icon}</span><span><strong>${s.name}</strong><small>${(minutes/60).toFixed(1)} study hours</small></span><span class="subject-number">${pct}%</span></div><div class="subject-track"><span style="width:${pct}%;background:linear-gradient(90deg,${s.tint},#9b87ff)"></span></div><div class="subject-bottom"><span>${chapDone}/${total} chapters</span><span>${minutes} min</span></div></article>`});$('subjectCards').innerHTML=html}
function renderProgress(){const p=state.profile||blankProfile('student');const week=state.logs.filter(x=>x.date>=weekStart(TODAY)&&x.date<=TODAY).reduce((s,x)=>s+x.totalMinutes,0);$('progressTotalHours').textContent=((p.totalMinutes||0)/60).toFixed(1);$('progressWeekHours').textContent=(week/60).toFixed(1);$('progressSessions').textContent=p.sessionsCompleted||0;$('progressDays').textContent=p.studyDays||0}
function renderSyllabus(){let html='';CHAPTERS.forEach(group=>{const items=group.items.map((title,i)=>{const id=slug(`${group.subject}-${i}-${title}`);const done=state.completed.includes(id);return `<label class="chapter-item ${done?'done':''}"><input type="checkbox" data-chapter="${id}" ${done?'checked':''}> <span>${safeName(title)}</span></label>`}).join('');const completed=group.items.filter((_,i)=>state.completed.includes(slug(`${group.subject}-${i}-${group.items[i]}`))).length;html+=`<div class="syllabus-subject"><div class="syllabus-subject-head"><span>${group.subject}</span><small>${completed} / ${group.items.length} completed</small></div><div class="syllabus-items">${items}</div></div>`});$('syllabusList').innerHTML=html;const count=state.completed.length;$('syllabusCount').textContent=`${count} / ${$allChapters.length} DONE`;document.querySelectorAll('[data-chapter]').forEach(input=>input.addEventListener('change',e=>toggleChapter(e.target.dataset.chapter,e.target.checked)))}
function renderLeaderboard(){const list=$('leaderboardList');if(state.mode==='local'){const p=state.profile;if(!p){list.innerHTML='<div class="empty-state"><div class="empty-icon">♛</div><b>Claim your username to enter.</b><p>Set up a profile to start tracking your rank.</p></div>';return}state.leaderboard=[{...p,local:true}];}
  if(!state.leaderboard.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">♛</div><b>The arena is ready for its first players.</b><p>Invite friends after publishing the app and connecting Firebase.</p></div>';return}
  const sorted=[...state.leaderboard].sort((a,b)=>(b.totalPoints||0)-(a.totalPoints||0));list.innerHTML=sorted.map((p,i)=>{const mine=p.uid===state.uid||p.local;const rankClass=i===0?'gold':i===1?'silver':i===2?'bronze':'';return `<div class="leader-row ${mine?'me':''}"><div class="rank ${rankClass}">${i+1<10?'0'+(i+1):i+1}</div><div class="leader-user"><span class="leader-avatar">${safeName((p.username||'S').charAt(0).toUpperCase())}</span><span><b>@${safeName(p.username||'student')}${mine?'<span class="you-tag">YOU</span>':''}</b><small>${p.streak||0} day streak · ${p.chaptersCompleted||0} chapters</small></span></div><div class="leader-xp">${(p.totalPoints||0).toLocaleString()}<small>XP</small></div><div class="leader-hours">${((p.totalMinutes||0)/60).toFixed(1)}h</div></div>`}).join('')}
function renderActivity(){const list=$('activityList');if(!state.logs.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">◷</div><b>No sessions yet</b><p>Log your first session to start your history.</p></div>';return}list.innerHTML=[...state.logs].sort((a,b)=>b.date.localeCompare(a.date)).map(log=>{const sessions=[1,2].filter(n=>log[`session${n}`]?.minutes>0).map(n=>{const s=log[`session${n}`];return `<div class="activity-row"><div class="activity-icon">◷</div><div class="activity-main"><b>${safeName(s.subject||'Study session')} · Session ${n}</b><small>${formatDate(log.date)} ${s.topic?'· '+safeName(s.topic):''}</small></div><div class="activity-meta"><b>${(s.minutes/60).toFixed(2)}h</b><small>+${s.points||0} XP</small></div></div>`}).join('');return sessions}).join('')}
function navigate(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('crumbCurrent').textContent=({overview:'Overview',progress:'My progress',leaderboard:'Leaderboard',activity:'Study history'})[page]||'Overview';window.scrollTo({top:0,behavior:'smooth'})}
function exportData(){const data={profile:state.profile,logs:state.logs,completedChapters:state.completed,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`study-arena-${state.profile?.username||'backup'}.json`;a.click();URL.revokeObjectURL(url);toast('Your study backup is ready.')}
async function inviteFriends(){const text=`Join me on Study Arena! Let's build a study streak and climb the leaderboard: ${location.origin}`;try{if(navigator.share)await navigator.share({title:'Study Arena',text,url:location.origin});else{await navigator.clipboard.writeText(text);toast('Invite link copied. Share it with your friends.')}}catch(e){if(e.name!=='AbortError')toast('Copy this page URL to invite friends.') }}

// UI wiring
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.goto)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
$('claimUsernameBtn').addEventListener('click',claimUsername);$('saveLogBtn').addEventListener('click',saveStudyLog);$('shareBtn').addEventListener('click',inviteFriends);$('exportBtn').addEventListener('click',exportData);$('refreshBoardBtn').addEventListener('click',()=>{if(state.mode==='live')subscribeLive();else renderLeaderboard();toast('Leaderboard refreshed.')});
['logNowBtn','missionLogBtn'].forEach(id=>$(id).addEventListener('click',()=>{if(!state.profile){showModal('profileModal');return}$('logDate').value=TODAY;showModal('logModal')}));$('profileChip').addEventListener('click',()=>state.profile?toast(`Signed in as @${state.profile.username}`):showModal('profileModal'));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('installBtn').hidden=false});$('installBtn').addEventListener('click',async()=>{if(!state.installPrompt){toast('Use your browser menu and choose Add to Home screen.');return}state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('installBtn').hidden=true});

async function boot(){
  $('logDate').value=TODAY;
  const local=getLocal();if(local.profile){state.profile=local.profile;state.logs=local.logs||[];state.completed=local.completed||[];state.uid='local-user';state.mode='local';setConnection('Local preview',false)}
  if(!state.profile){$('headerUsername').textContent='Set username';setConnection('Not connected',false)}
  renderAll();
  const live=await initFirebase();
  if(!live){const data=getLocal();if(data.profile){state.profile=data.profile;state.logs=data.logs||[];state.completed=data.completed||[];state.uid='local-user';state.mode='local';renderAll();setConnection('Local preview · connect Firebase for live',false)}else{setConnection('Setup required · local preview',false);$('leaderboardList').innerHTML='<div class="empty-state"><div class="empty-icon">♛</div><b>Connect Firebase to launch the live arena.</b><p>Local mode works on this device. Configure Firebase to share with friends in real time.</p></div>'}}
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('SW registration failed',err))}
  if(!state.profile)showModal('profileModal');
}
boot();
