const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const parties = {}; // code -> { hostId, players: { id: {username} } }
function makeCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
io.on("connection", (socket) => {
  socket.on("createParty", (username) => {
    let code;
    do { code = makeCode(); } while(parties[code]);
    parties[code] = { hostId: socket.id, players: {} };
    parties[code].players[socket.id] = { username };
    socket.join(code);
    socket.data.code = code;
    socket.data.username = username;
    socket.emit("partyCreated", { code });
    io.to(code).emit("playerListUpdate", parties[code].players);
  });
  socket.on("joinParty", ({ code, username }) => {
    code = (code || "").toUpperCase();
    const party = parties[code];
    if(!party){ socket.emit("joinError", "Party not found"); return; }
    party.players[socket.id] = { username };
    socket.join(code);
    socket.data.code = code;
    socket.data.username = username;
    socket.emit("partyJoined", { code });
    io.to(code).emit("playerListUpdate", party.players);
  });
  socket.on("setPartyInfo", (info) => {
    const code = socket.data.code;
    const party = parties[code];
    if(!party || party.hostId !== socket.id) return;   // only the host can change it
    party.name = String((info && info.name) || "").slice(0, 24);
    party.isPublic = !!(info && info.isPublic);
  });

  socket.on("getPublicParties", () => {
    const list = Object.keys(parties)
      .filter(c => parties[c].isPublic)
      .slice(0, 12)
      .map(c => ({
        code: c,
        name: parties[c].name || "Party",
        players: Object.keys(parties[c].players).length
      }));
    socket.emit("publicParties", list);
  });

  socket.on("startGame", () => {
    const code = socket.data.code;
    if(!code || !parties[code] || parties[code].hostId !== socket.id) return;
    parties[code].isPublic = false;   // started games can't be joined from the public list
    io.to(code).emit("gameStarted");
  });
  socket.on("enemyState", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("enemyState", data);
  });
  socket.on("grantToPlayer", (data) => {
    if(!data || !data.targetId || !data.event) return;
    io.to(data.targetId).emit(data.event, data.payload || {});
  });
  socket.on("killEnemy", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("killEnemy", data);
  });
  socket.on("collectItem", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("collectItem", data);
  });
  socket.on("bulletFired", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("bulletFired", data);
  });
  socket.on("wormHit", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("wormHit", data);
  });
  socket.on("playerDied", (data) => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("playerDied", { id: socket.id });
  });
  socket.on("allDead", () => {
    const code = socket.data.code;
    if(!code) return;
    socket.to(code).emit("allDead");
  });
  socket.on("posUpdate", (data) => {
    const code = socket.data.code;
    if(!code) return;
    data.id = socket.id;
    socket.to(code).emit("posUpdate", data);
  });
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if(!code || !parties[code]) return;
    delete parties[code].players[socket.id];
    io.to(code).emit("playerLeft", socket.id);
    if(parties[code].hostId === socket.id){
      io.to(code).emit("hostLeft");
      delete parties[code];
    } else {
      io.to(code).emit("playerListUpdate", parties[code].players);
    }
  });
});
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("listening on " + PORT));
