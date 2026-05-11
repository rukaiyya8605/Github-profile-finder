document.addEventListener("DOMContentLoaded", () => {

/* ================= ELEMENTS ================= */

const historyList = document.getElementById("history");
const suggestionBox = document.getElementById("suggestions");
const profileBox = document.getElementById("profileBox");
const repoList = document.getElementById("repoList");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const input = document.getElementById("username");
const toggleBtn = document.getElementById("toggle-mode");

/* ================= STATE ================= */

let historyData = JSON.parse(localStorage.getItem("history")) || [];
let debounceTimer;
let selectedIndex = -1;

let chartInstance = null;
let statsChart = null;

/* ================= THEME ================= */

window.setTheme = function(val){
  if(window.themeTarget !== undefined){
    window.themeTarget = val;
  }
};

const savedMode = localStorage.getItem("mode");

if(savedMode === "light"){
  document.body.classList.add("light");
  toggleBtn.textContent = "☀️";
  window.setTheme(1);
}else{
  toggleBtn.textContent = "🌙";
  window.setTheme(0);
}

/* ================= HISTORY ================= */

function displayHistory(){
  historyList.innerHTML = "";

  historyData.slice(0,5).forEach(item=>{
    const li = document.createElement("li");
    li.textContent = "🔍 " + item;

    li.onclick = () => {
      input.value = item;
      searchGitHub();
    };

    historyList.appendChild(li);
  });
}

function saveHistory(q){
  if(!historyData.includes(q)){
    historyData.unshift(q);
    localStorage.setItem("history", JSON.stringify(historyData));
    displayHistory();
  }
}

displayHistory();

/* ================= SUGGESTIONS ================= */

input.addEventListener("input", () => {

  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {

    const keyword = input.value.trim().toLowerCase();
    suggestionBox.innerHTML = "";
    selectedIndex = -1;

    if(keyword.length < 2) return;

    let local = historyData.filter(h =>
      h.toLowerCase().includes(keyword)
    );

    let api = [];

    try{
      const res = await fetch(
        `https://api.github.com/search/users?q=${keyword}`
      );
      const data = await res.json();
      api = (data.items || []).map(u => u.login);
    }catch{}

    const combined = [...new Set([...local, ...api])].slice(0,10);

    combined.forEach((item)=>{
      const li = document.createElement("li");
      li.textContent = item;

      li.onclick = () => {
        input.value = item;
        suggestionBox.innerHTML = "";
        searchGitHub();
      };

      suggestionBox.appendChild(li);
    });

  },300);
});

/* ================= KEYBOARD NAV ================= */

input.addEventListener("keydown",(e)=>{

  const items = suggestionBox.querySelectorAll("li");
  if(!items.length) return;

  if(e.key === "ArrowDown"){
    e.preventDefault();
    selectedIndex = (selectedIndex + 1) % items.length;
  }

  if(e.key === "ArrowUp"){
    e.preventDefault();
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
  }

  if(e.key === "Enter"){
    e.preventDefault();

    if(selectedIndex >= 0){
      items[selectedIndex].click();
      return;
    }

    searchGitHub();
  }

  items.forEach((el,i)=>{
    el.classList.toggle("active", i === selectedIndex);
  });

});

/* ================= PREVIEW RESET (FIX) ================= */

function resetPreview(){

  if(chartInstance){
    chartInstance.destroy();
    chartInstance = null;
  }

  if(statsChart){
    statsChart.destroy();
    statsChart = null;
  }

  previewPlaceholder.style.display = "block";

  previewPlaceholder.innerHTML = `
    <p style="text-align:center;opacity:.7;">
      Search a user to see analytics
    </p>
  `;
}

/* ================= MAIN SEARCH ================= */

async function searchGitHub(){

  const query = input.value.trim();
  if(!query) return;

  suggestionBox.innerHTML = "";
  showSkeleton();

  try{

    const userRes = await fetch(`https://api.github.com/users/${query}`);

    // ✅ only fallback when real 404
    if(userRes.status === 404){
      searchProjectRepositories(query);
      return;
    }

    const user = await userRes.json();

    if(!user || user.message){
      searchProjectRepositories(query);
      return;
    }

    const repoRes = await fetch(
      `https://api.github.com/users/${query}/repos?per_page=6`
    );
    const repos = await repoRes.json();

    /* ===== PROFILE ===== */
    profileBox.innerHTML = `
      <img src="${user.avatar_url}">

      <h2>${user.name || user.login}</h2>
      <p style="opacity:.7">@${user.login}</p>

      <p style="margin:10px 0;">
        ${user.bio || "No bio available"}
      </p>

      <div style="text-align:left;font-size:14px;margin-top:10px;line-height:1.6;">
        <p>📍 Location: ${user.location || "Not specified"}</p>
        <p>🏢 Company: ${user.company || "Not specified"}</p>
        <p>📅 Joined: ${new Date(user.created_at).toDateString()}</p>
      </div>

      <div style="margin-top:15px;font-size:14px;">
        👥 ${user.followers} &nbsp;
        ➡ ${user.following} &nbsp;
        📦 ${user.public_repos}
      </div>

      <a class="visit-btn" href="${user.html_url}" target="_blank">
        🚀 Visit Profile
      </a>
    `;

    previewPlaceholder.style.display = "none";
    previewPlaceholder.innerHTML = "";

    renderCharts(repos,user);
    getRepos(query);
    saveHistory(query);

  }catch{
    profileBox.innerHTML = emptyBlock("Error loading profile");
  }
}

/* ================= PROJECT SEARCH ================= */

async function searchProjectRepositories(keyword){

  resetPreview(); // ✅ MAIN FIX

  repoList.innerHTML = skeletonBlock();
  profileBox.innerHTML = "<h3>👨‍💻 Developers</h3>";

  try{

    const res = await fetch(
      `https://api.github.com/search/repositories?q=${keyword}&per_page=20`
    );

    const data = await res.json();

    if(!data.items || data.items.length === 0){
      repoList.innerHTML = emptyBlock("No repositories found");
      profileBox.innerHTML = emptyBlock("No developers found");
      return;
    }

    repoList.innerHTML = "";
    profileBox.innerHTML = "";

    const uniqueUsers = new Map();

    data.items.forEach(repo => {
      if(!uniqueUsers.has(repo.owner.login)){
        uniqueUsers.set(repo.owner.login, repo);
      }
    });

    const filtered = Array.from(uniqueUsers.values()).slice(0,6);

    filtered.forEach(repo => {

      profileBox.innerHTML += `
        <div style="text-align:center;margin-bottom:15px;">
          <img src="${repo.owner.avatar_url}" width="60" style="border-radius:50%">
          <p>${repo.owner.login}</p>
        </div>
      `;

      repoList.innerHTML += `
        <div class="repo-card" onclick="window.open('${repo.html_url}')">
          <h4>${repo.name}</h4>
          <div style="margin-top:8px;font-size:13px;display:flex;justify-content:space-between;">
            <span>⭐ ${repo.stargazers_count}</span>
            <span>🍴 ${repo.forks_count}</span>
          </div>
        </div>
      `;
    });

  }catch{
    repoList.innerHTML = emptyBlock("Error loading data");
  }
}

/* ================= REPOS ================= */

async function getRepos(user){

  repoList.innerHTML = skeletonBlock();

  const res = await fetch(
    `https://api.github.com/users/${user}/repos?per_page=6`
  );

  const repos = await res.json();

  if(!repos.length){
    repoList.innerHTML = emptyBlock("No repositories available");
    return;
  }

  repoList.innerHTML = "";

  repos.forEach(r=>{
    repoList.innerHTML += `
      <div class="repo-card" onclick="window.open('${r.html_url}')">
        <h4>${r.name}</h4>
        <div style="margin-top:8px;font-size:13px;display:flex;justify-content:space-between;">
          <span>⭐ ${r.stargazers_count}</span>
          <span>🍴 ${r.forks_count}</span>
        </div>
      </div>
    `;
  });
}

/* ================= CHARTS ================= */

function renderCharts(repos,user){

  const ctx = document.getElementById("statsChart");

  if(chartInstance) chartInstance.destroy();

  const lang = {};

  repos.forEach(r=>{
    if(r.language){
      lang[r.language] = (lang[r.language]||0)+1;
    }
  });

  if(Object.keys(lang).length === 0){
    previewPlaceholder.style.display = "block";
    previewPlaceholder.innerHTML = `
      <p style="text-align:center;opacity:.7;">
        No analytics data available
      </p>
    `;
    return;
  }

  chartInstance = new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:Object.keys(lang),
      datasets:[{data:Object.values(lang)}]
    }
  });

  const ctx2 = document.getElementById("profileStatsChart");

  if(statsChart) statsChart.destroy();

  statsChart = new Chart(ctx2,{
    type:"bar",
    data:{
      labels:["Followers","Following","Repos"],
      datasets:[{
        data:[user.followers,user.following,user.public_repos]
      }]
    }
  });
}

/* ================= UI BLOCKS ================= */

function emptyBlock(msg){
  return `<div style="text-align:center;opacity:.7;padding:20px;">${msg}</div>`;
}

function skeletonBlock(){
  return `
    <div class="skeleton">
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
    </div>
  `;
}

/* ================= LOADING ================= */

function showSkeleton(){
  profileBox.innerHTML = skeletonBlock();
  repoList.innerHTML = skeletonBlock();
}

/* ================= THEME ================= */

toggleBtn.onclick = () => {

  document.body.classList.toggle("light");

  const isLight = document.body.classList.contains("light");

  toggleBtn.textContent = isLight ? "☀️" : "🌙";

  localStorage.setItem("mode", isLight ? "light" : "dark");

  window.setTheme(isLight ? 1 : 0);
};

});