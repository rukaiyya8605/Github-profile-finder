const canvas = document.getElementById("space-bg");
const ctx = canvas.getContext("2d");

let themeT = 0;

/* ================= THEME SYNC ================= */
window.setTheme = function(val){
  window.themeTarget = val;
};

window.themeTarget = 0;

/* ================= RESIZE ================= */

function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ================= UPDATE THEME ================= */

function updateTheme(){
  themeT += ((window.themeTarget ?? 0) - themeT) * 0.08;
}

/* ================= BACKGROUND ================= */

function drawBackground(){

  let r = themeT > 0.5 ? 245 : 0;
  let g = themeT > 0.5 ? 245 : 0;
  let b = themeT > 0.5 ? 255 : 15;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

/* ================= STARS ================= */

class Star{
  constructor(){
    this.reset();
  }

  reset(){
    this.x = Math.random()*canvas.width;
    this.y = Math.random()*canvas.height;
    this.z = Math.random()*500;
  }

  update(){
    this.z -= 2;
    if(this.z <= 0) this.reset();
  }

  draw(){

    let k = 128/this.z;
    let x = (this.x - canvas.width/2)*k + canvas.width/2;
    let y = (this.y - canvas.height/2)*k + canvas.height/2;

    let brightness = themeT > 0.5 ? 80 : 255;

    ctx.fillStyle = `rgba(${brightness},${brightness},255,0.8)`;
    ctx.fillRect(x,y,2,2);
  }
}

let stars = [];
for(let i=0;i<300;i++) stars.push(new Star());

/* ================= LOOP ================= */

function animate(){

  updateTheme();
  drawBackground();

  stars.forEach(s=>{
    s.update();
    s.draw();
  });

  requestAnimationFrame(animate);
}

animate();