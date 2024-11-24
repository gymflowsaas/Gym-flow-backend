const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../server/config');

var socket_io; 
var socketController = {}
let decoded_socket_data ;
var connectedSockets = new Map();

socketController.initializeSocket = (io) => {

    socket_io = io;

    socket_io.use(function(socket,next){
        
        if (socket.handshake.query && socket.handshake.query.token){
          
            jwt.verify(socket.handshake.query.token, config.jwt_secret, function(err, decoded) {
              decoded_socket_data = decoded;
              if (err) {
                 // incase of primary token failure. we use the refresh token to backup verify the user.
                 if (socket.handshake.query.refreshToken) {
                
                  jwt.verify(socket.handshake.query.refreshToken, config.jwt_secret, function (err, decoded) {
                    if (err) {
                      
                      return next(new Error('Authentication error'));
                    }

                    decoded_socket_data = decoded;
                    
                  })
                } else {
                  return next(new Error('Authentication error'));
                }
  
              }
              socket.decoded = decoded_socket_data;
              if(!connectedSockets.has(decoded_socket_data.email)) {
                    connectedSockets.set(socket.decoded.email,socket)
              } else {
                var existingSocketCon = connectedSockets.get(socket.decoded.email)
                existingSocketCon.disconnect();
                connectedSockets.delete(existingSocketCon.decoded.email);
                connectedSockets.set(socket.decoded.email,socket)
              }
              next();
            });
          }
          else {
            return next(new Error('Authentication error'));
          }  

          
          

    }).on('connection',(__socket) => {

        
        
        
        console.log('connected', __socket.id);
        // simple printing of sockets when one joins. just for checking purposes.
        connectedSockets.forEach((element,index) => {
          console.log({email : index, id : element.id})
        })

        
        socket_io.emit('connected',{
          cmd : 'connected',
          data : {
            request_type : 'socket_connection',
            status : 'success',
            id : __socket.id
          }
        })

        

        __socket.on('disconnect',(event) => {
            console.log('disconnected',{
              email : __socket.decoded.email,
              id : __socket.id
            })
            console.log(__socket.decoded.email)
            connectedSockets.delete(__socket.decoded.email)
            console.log('Remaining Emails builtin disconnect--', connectedSockets.keys())
        })

        __socket.on('clear_full', (event) => {
          connectedSockets.clear();
          console.log('Remaining Emails after full clear--', connectedSockets.keys())

        })

        __socket.on('manual_disconnect',(event) => {
          
          __socket.disconnect();
          connectedSockets.delete(__socket.decoded.email)
          console.log('Remaining Emails manual disconnect--', connectedSockets.keys())

        })

    }).on('connect_failed', function(){
        console.log('Connection Failed');
    });
}

socketController.emit = (email,payload) => {
    console.log('emitting....',email,payload);
    var socket =  connectedSockets.get(email);
    return socket_io.emit(email,payload)
}

module.exports = socketController;