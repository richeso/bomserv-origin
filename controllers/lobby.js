const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const Lobby = require('../models/Lobby');
const User = require('../models/User');
const excludeLobbyFields = { 
	    __v: false,
	    _id: false,
	    apiToken: false,
	    lobbyguid: false,
	    secret: false
	};

// Variables used for generating id numbers
const UNIQUE_RETRIES = 9999;
const ALPHABET = '0123456789';
// const ALPHABET = '23456789abdegjkmnpqrvwxyz';
const ID_LENGTH = 8;

var parseAuthHeader = function(req,res) {
	var auth = req.headers['authorization'];  // auth is in base64(username:password)  so we need to decode the base64
	console.log("Authorization Header is: ", auth);
	var tmp = auth.split(' ');   // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
	var buf = new Buffer(tmp[1], 'base64'); // create a buffer and tell it the data coming in is base64
	var plain_auth = buf.toString();        // read it back out as a string
	console.log("Decoded Authorization ", plain_auth);
	// At this point plain_auth = "username:password"
	var creds = plain_auth.split(':');      // split on a ':'
	var username = creds[0];
	var password = creds[1];
	console.log("username="+username+ " password="+password);
	return [username, password];
};

var generate = function() {
  var rtn = '';
  for (var i = 0; i < ID_LENGTH; i++) {
    rtn += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return rtn;
}

var generateUnique = function() {
  var retries = 0;
  var id;

  // Try to generate a unique ID,
  // i.e. one that isn't in the previous.
  while(!id && retries < UNIQUE_RETRIES) {
    id = generate();
    // check if id exists currently
    Lobby.findOne({ id: id }, (err, lobby) => {
	    if (err) { res.send(err)};
        if (lobby) {
           id = null;
           retries++;
        }
	});
  }
  return id;
};

var updateExpires = function (lobby) {
	lobby.expires = Date.now() + (60*1000); // 60 seconds
	//lobby.expires = Date.now() + (2*60*60*1000); // 2 hours
	lobby.lastupdated = Date.now();
}

exports.testBasicAuth = (req, res, next) => {
	creds = parseAuthHeader(req,res);
	email=creds[0];
	password=creds[1];
	if (email.toLowerCase() == "apitoken")  {
		User.findOne({ apiToken: password }, (err, user) => {
		    if (err) { return next("Error: " +err)};  
	        res.send(user);
		});
	} else {
		User.findOne({ email: email }, (err, user) => {
		    if (err) { return next("Error: " +err)};  
	        res.send(user);
		});
	}
	
};

exports.findAll = (req, res, next) => {
	Lobby.find({}, excludeLobbyFields, function(err, docs) {
	    if (!err){ 
	        console.log(docs);
	        res.send(docs);
	    } else {
	    	res.send("Error: " +err);
	    }
	});
    
};

exports.findById = (req, res, next) => {
	var lobbyid = req.params.id;
	var passwd  = req.params.secret;
	Lobby.findOne({ id: lobbyid, secret: passwd }, (err, lobby) => {
	    if (err) { res.send("Error: " +err)};
        res.send(lobby);
	});
   
};

exports.addLobby = (req, res, next) => {
	var data = req.body;
    var datastr = JSON.stringify(data);
    var username = req.user.email;
    console.log('Adding Lobby: ' + datastr);
    const lobby = new Lobby({
        name: data.name,
        lobbyguid: data.lobbyguid,
        gametype: data.gametype,
        roomtype: data.roomtype,
        countrycode: data.countrycode,
        username: username,
        teams: data.teams,
        items: data.items,
        numconnected: data.numconnected,
        numallowed: data.numallowed
    });
    if (data.secret)
    	lobby.secret = data.secret;
    else
    	lobby.secret = "public";
    
    if (data.id)
    	lobby.id = data.id;
    else
    	lobby.id = generateUnique();
    
    //lobby.expires = Date.now() + (2*60*60*1000); // 2 hours
    updateExpires(lobby);
    
    lobby.save((err) => {
	      if (err) { return next("Error: "+err);  }
	      else { res.send(lobby);}
	} );
};

exports.updateLobby = (req, res, next) => {
      var lobbyid = req.params.id;
  	  var passwd  = req.params.secret;
  	  var userid = req.user.email;
  	  var isValid = true;
	  async.waterfall([
	    function findLobby(done) { 
	    	Lobby.findOne({ id: lobbyid }, (err, lobby) => {
	    	    if (err) {
	    	    	isValid = false;
	    	    	res.send("Error: "+err);
	    	    }
	    	     
	    	    if (lobby && lobby.secret != passwd) {
	    	    	  isValid = false;
	    	    	  err = "Error: Invalid secret: "+ passwd+ " doesn't match !";
	    	    	  res.send (err);
	    	    }
	    	     
	    	    if (lobby && lobby.username != userid) {
	    	    	 isValid = false;
	    	    	 err = "Error: Invalid username: "+userid+ " doesn't match !";
	    	    	 res.send (err);
	    	    }
	    	     
	    	    done(err, lobby); 
	    	});    	
	    },
	    function updateit(lobby, done) {
		    if (lobby && isValid) {
		        var data = req.body;
                var datastr = JSON.stringify(data);
		        if (data.name) lobby.name=data.name;
		        if (data.id) lobby.id=data.id;
		        if (data.lobbyguid) lobby.lobbyguid=data.lobbyguid;
			    if (data.secret) lobby.secret=data.secret;
			    if (data.gametype) lobby.gametype=data.gametype;
			    if (data.roomtype) lobby.roomtype=data.roomtype;
			    if (data.countrycode) lobby.countrycode=data.countrycode;
			    if (data.items) lobby.items=data.items;
			    if (data.teams) lobby.teams=data.teams;
			    if (data.numconnected) lobby.numconnected=data.numconnected;
			    if (data.numallowed) lobby.numallowed=data.numallowed;
			    updateExpires(lobby);
		    	lobby.save((err) => {
		      		if (err) { return next(err);  }
		      		else { res.send("Updated Lobby: "  + lobby);}
				});
		    	
		    } else {
		       res.send ("Error: Invalid id not found: "+lobbyid);
		    }
	    }
	  ], (err) => {
	    if (err) { return next(err); }
	    res.send("Updated:"+lobby);
	  });
};

exports.delete = (req, res, next) => {
	  var lobbyid = req.params.id;
	  var passwd = req.params.secret;
  	  var userid = req.user.email;
	  async.waterfall([
	    function findLobby(done) {
	    	Lobby.findOne({ id: lobbyid , secret: passwd , username: userid}, (err, lobby) => {
	    	    if (err) { res.send("Error: " +err) }
	    	    done(err, lobby); 
	    	});
	    },
	    function deleteIt(lobby, done) {
		    if (lobby) {
		    	Lobby.remove({ _id: lobby._id }, (err) => {
		    	    if (err) { return next("Error: "+err); }
		    	    else {
		    	       res.send("Deleted:"+lobbyid);
		    	       }
		    	});
		    	
		    } else {
		    	res.send("Error: Lobby not found or Wrong Password: "+lobbyid);
		    }
	    }
	  ], (err) => {
	    if (err) { return next(err); }
	    res.send("Deleted:"+lobby);
	  });
};

exports.join = (req, res, next) => {
      var lobbyid = req.params.id;
      var passwd = req.params.secret;
      
	  async.waterfall([
	    function findLobby(done) {
	    	Lobby.findOne({ id: lobbyid , secret: passwd }, (err, lobby) => {
	    	    if (err) { res.send(err) }
	    	    done(err, lobby); 
	    	});
	    },
	    function updateit(lobby, done) {
		    if (lobby) {
		        var tempnum = lobby.numconnected;
		        if (tempnum < lobby.numallowed) {
		        	lobby.numconnected = tempnum+1;
		        }
		        updateExpires(lobby);
		    	lobby.save((err) => {
		      		if (err) { return next(err);  }
		      		else { res.send("Updated Lobby: "  + lobbyid);}
				});
		    	
		    } else {
		        // Lobby was not found - cannot add Player
		    	res.send("Error: Lobby not found: "+lobbyid);
		    }
	    }
	  ], (err) => {
	    if (err) { return next(err); }
	    res.send("Error: Lobby Join Problem:"+lobby);
	  });
};

exports.leave = (req, res, next) => {
      var lobbyid = req.params.id;
      var passwd = req.params.secret;
      console.log ("leaving lobby: "+lobbyid);
	  async.waterfall([
	    function findLobby(done) {
	    	Lobby.findOne({ id: lobbyid , secret: passwd}, (err, lobby) => {
	    	    if (err) { res.send(err) }
	    	    done(err, lobby); 
	    	});
	    },
	    function updateit(lobby, done) {
		    if (lobby) {
		    	var tempnum = lobby.numconnected;
		        if (lobby.numconnected > 1) {
			        lobby.numconnected = tempnum-1;
		        }
		        updateExpires(lobby);
		    	lobby.save((err) => {
		      		if (err) { return next(err);  }
		      		else { res.send("updated Lobby: "  + lobbyid);}
				});
		    	
		    } else {
		    	 // Lobby was not found - cannot Delete Player
		    	res.send("Lobby was not found: "+lobbyid);
		    }
	    }
	  ], (err) => {
	    if (err) { return next(err); }
	    res.send("Lobby Leave Error:"+lobby);
	  });
};