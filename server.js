// jshint esversion:8

"use strict";

const Hapi = require("hapi");
const Path = require('path');
const io = require('./lib/sockets');

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    console.log("ADDRESS", add);
});

const config = {
    port: 8061,
    routes: {
        cors: true,
        files: {
            relativeTo: Path.join(__dirname, 'dist')
        }
    }
};

const panes = {};

function getNames()
{
    let ret = [];
    Object.values(panes).forEach(client => {
        Object.values(client).forEach(pane => {
            ret.push(pane[1].session + "." + pane[0].replace('%',''));
        })
    });
    return ret;
}

function getLines(pane)
{
    if (!Object.keys(panes).length) return [];
    let session = pane.split(".").shift();
    pane = "%" + pane.split(".").pop()
    return Object.values(panes[Object.keys(panes).shift()]).find(p => {
        return (p[0] === pane && p[1].session === session)
    }).pop();
}

const init = async () => {
    const server = Hapi.server(config);
    io.init(server.listener);

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return h.file('index.html');
        }
    });

    server.route({
        method: 'GET',
        path: '/css/{file_name}',
        handler: async function (request, h) {
            let _path = Path.join('css', request.params.file_name);
            return h.file(_path);
        }
    });
  
    server.route({
        method: 'GET',
        path: '/js/{file_name}',
        handler: async function (request, h) {
            let _path = Path.join('js', request.params.file_name);
            return h.file(_path);
        }
    });
  
    server.route({
        method: 'GET',
        path: '/img/{file_name}',
        handler: async function (request, h) {
            let _path = Path.join('img', request.params.file_name);
            return h.file(_path);
        }
    });

    server.route({
        method: "GET",
        path: "/tmux/servers",
        handler: async (request, h) => {
            return io.getServers();
        }
    });

    server.route({
        method: "GET",
        path: "/tmux/sessions/{server}",
        handler: function(request, h) {
            return io.getSessions(request.params.server);
        }
    });

    server.route({
        method: 'GET',
        path: '/tmux/windows/{server}/{session}',
        handler: function(request, h) {
            return io.getWindows(request.params.server, "$" + request.params.session);
        }
    });

    server.route({
        method: 'GET',
        path: '/tmux/panes/{server}/{session}/{window}',
        handler: function(request, h) {
            return io.getPanes(request.params.server, "$" + request.params.session, "@" + request.params.window);
        }
    });

    server.route({
        method: 'GET',
        path: '/tmux/pane-data/{server}/{session}/{window}',
        handler: function(request, h) {
            return io.getPaneDataFromWindow(request.params)
        }
    });

    server.route({
        method: 'GET',
        path: '/tmux/pane-data/{server}/{session}/{window}/{pane}',
        handler: function(request, h) {
            return io.getPaneData(request.params)
        }
    });

    await server.register(require('@hapi/inert'));
    await server.start();
    console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", err => {
    console.log(err);
    process.exit(1);
});

init();