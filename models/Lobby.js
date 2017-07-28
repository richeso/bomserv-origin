const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const lobbySchema = new mongoose.Schema({
  name: String,
  id: { type: String, unique: true },
  numconnected:  {type: Number, default: 1, min: 1, max: 6},
  numallowed:    {type: Number, default: 1, min: 1, max: 6},
  lobbyguid:     String,
  gametype: String,
  roomtype: String,
  countrycode: String,
  username: String,
  teams: { type: Boolean, default: false },
  items: { type: Boolean, default: false },
  secret: String,
  expires: { type: Date,  default: () => +new Date + 60*1000, expires: 0 },
  lastupdated: { type: Date, default: Date.now },
}, { timestamps: true });

const Lobby = mongoose.model('Lobby', lobbySchema);

module.exports = Lobby;
