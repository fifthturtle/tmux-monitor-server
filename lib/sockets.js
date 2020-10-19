// This module maintains the websockets for the Node server
// There are two channels for the websockets:
//      1. /tmux-logging -- a channel to each of the tmux-instances connected to the Node Server
//      2. /tmux-app -- a channel to each of the browsers running the Vue app to monitor the tmux
//  
// Socket.io is used, which allows for the multiple channels and also allows for the websocket to run on the same port as the server
// Module processes incoming data from a TMUX logger instance and sends it to all the Vue apps
// Also takes incoming data from Vue apps and routes it to proper module.

'use strict'

let io;
const Server = require('./tmux/server');
const capturePane = require('./capturePane');
const sha1 = require('sha1');
const fs = require('fs-extra');

const SERVER = 'server';
const SESSION = 'session';
const WINDOW = 'window';
const PANE = 'pane';
const TYPES = [SERVER, SESSION, WINDOW, PANE];
let servers = {};

let sockets = { loggers: [], vue: [] };

function hasServer(id)
{
    return Object.keys(servers).includes(id);
}

function init(listener)
{
    io = require('socket.io')(listener, { 
        handlePreflightRequest: (req, res) => {
            const headers = {
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
                "Access-Control-Allow-Credentials": true
            };
            res.writeHead(200, headers);
            res.end();
        },
        path: "/myapp/socket.io" });

    const loggers = io.of('/tmux-logging');
    const vue = io.of('/tmux-app');

    loggers.on('connection', function(socket) {
        if (!hasServer(socket.client.id)) {
            servers[socket.client.id] = new Server(socket.client.id, 'default');
            vue.emit('update component', { type: SERVER, components: getServers() });
        }

        socket.on('disconnect', async () => {
            await servers[socket.client.id].destroy([]).then(res => {
                if (res) delete servers[socket.client.id];
                vue.emit('update component', { type: SERVER, components: getServers() });
            })
        });
        
        socket.on('tmux-init', data => {
            switch (data.components.length) {
                case 0:
                    if (!hasServer(socket.client.id)) {
                        servers[socket.client.id] = new Server(socket.client.id, data.name);
                    }
                    break;
                case 1:
                    servers[socket.client.id].add_session({ id: data.components.shift(), name: data.name });
                    vue.to(`0-${socket.client.id}`).emit('update component', { type : SESSION, components: getSessions(socket.client.id)});
                    break;
                case 2:
                    let sessionId = data.components[0];
                    servers[socket.client.id].add_window(data);
                    try {
                        //vue.to(`0-${socket.client.id}`).to(`1-${sessionId}`).emit('update component', { type: WINDOW, components: getWindows(socket.client.id, sessionId)});
                        vue.to(`1-${sessionId}-${socket.client.id}`).emit('update component', { type: WINDOW, components: getWindows(socket.client.id, sessionId)});
                    } catch(err) {
                        console.log('err', 'window not set up yet');
                    }
                    
                    break;
                case 3:
                    servers[socket.client.id].add_pane(data);
                    break;
                default:
                    break;
            }
        });

        socket.on('tmux-update', data => {
            data.id = socket.client.id;
            let s = servers[data.id];
            if (!s) return;
            if (!data.components) data.components = [];
            data.type = data.components.length;
            data.components.forEach((c, index) => {
                data.id = c;
                s = s[TYPES[index + 1] + 's'][data.id];
            })
            if (!s) return;
            s[data.key] = data.value;

            if (data.key === 'name')
            {
                if (data.type === TYPES.indexOf(SERVER)) vue.emit('component data', data);
                if (data.type === TYPES.indexOf(SESSION)) vue.to(`0-${socket.client.id}`).emit('component data', data);
                //if (data.type === TYPES.indexOf(WINDOW)) vue.to(`0-${socket.client.id}`).to(`1-${data.components.shift()}`).emit('component data', data);
                if (data.type === TYPES.indexOf(WINDOW)) vue.to(`1-${data.components.shift()}-${socket.client.id}`).emit('component data', data);
            }

            if (data.key === 'layout')
            {
                //vue.to(`0-${socket.client.id}`).to(`2-${data.id}`).emit('windowLayout', { id: data.id, layout: data.value });
                vue.to(`2-${data.id}-${socket.client.id}`).emit('windowLayout', { id: data.id, layout: data.value });
            }
        });

        socket.on('tmux-destroy', async data => {
            let s = servers[socket.client.id];
            if (!data.components) return;
            let comp = data.components.slice();
            await s.destroy(data.components).then(res => {
                if (res) {
                    delete servers[socket.client.id];
                }
                switch (comp.length) {
                    case 1:
                        vue.to(`0-${socket.client.id}`).emit('update component', { type : SESSION, components: getSessions(socket.client.id)});
                        break;
                    case 2:
                        //vue.to(`0-${socket.client.id}`).to(`1-${comp[0]}`).emit('update component', { type: WINDOW, components: getWindows(socket.client.id, comp[0])});
                        vue.to(`1-${comp[0]}-${socket.client.id}`).emit('update component', { type: WINDOW, components: getWindows(socket.client.id, comp[0])});
                        break;
                    default:
                        break;
                }
            });
        });

        socket.on('pane-data', (data) => {
            try {
                let id = data.components.pop();
                let windowId = data.components.pop();
                let sessionId = data.components.pop();
                let pane = servers[socket.client.id].sessions[sessionId].windows[windowId].panes[id];
                //vue.to(`0-${socket.client.id}`).to(`2-${windowId}`).emit('paneData', { id, lines: data.lines })
                vue.to(`2-${windowId}-${socket.client.id}`).emit('paneData', { id, lines: data.lines })
                pane.addLines(data.lines);
            } catch(err) {
                //console.log("pane not initialized");
            }
        });

        socket.on('pane-top-data', data => {
            try {
                let id = data.components.pop();
                let windowId = data.components.pop();
                let sessionId = data.components.pop();
                let pane = servers[socket.client.id].sessions[sessionId].windows[windowId].panes[id];
                pane.top = data.top;
                //vue.to(`0-${socket.client.id}`).to(`2-${windowId}`).emit('paneTopData', { id, data: data.top })
                vue.to(`2-${windowId}-${socket.client.id}`).emit('paneTopData', { id, data: data.top })
            } catch(err) {
                console.log("Pane not initialized");
            }
        })
    });

    vue.on('connection', (socket) => {
        sockets.vue.push(socket);
        socket.emit('update component', { type: SERVER, components: getServers() });

        socket.on('update-room', data => {
            let key = `${data.type}-${data.id[data.id.length - 1]}`;
            if (data.type) key = `${key}-${data.id[0]}`;
            Object.keys(socket.rooms).forEach(key => {
                if (key.split('-').shift() === data.type.toString()) socket.leave(key);
            });
            socket.join(key);
            if (data.type === 0) socket.emit('update component', { type: SESSION, components: getSessions(data.id.shift())});
            if (data.type === 1) socket.emit('update component', { type: WINDOW, components: getWindows(data.id.shift(), data.id.shift()) });
            if (data.type === 2) socket.emit('windowLayout', { windowId: data.id[data.id.length - 1], layout: getPanes(data.id) })
        });

        socket.on('tmux-command', (data) => {
            //if (data.command === 'restart-pane') {
            //    let pane = servers[data.current.server].sessions[data.current.session].windows[data.current.window].panes[data.params.id];
            //    capturePane.createImage({ selection: pane.lines, subject: "Pane Process Restarted" });
            //}
            loggers.to(`/tmux-logging#${data.current.server}`).emit(data.command, data.params);
        })

        socket.on('tmux-capture-pane', data => {
            capturePane.createImage(data);
        })

        socket.on('tmux-login', data => {
            let passwords = JSON.parse(fs.readFileSync(`${__dirname}/tmux/config.json`).toString()).passwords;
            let match = (data.password === sha1(passwords.user)) ? 1 : (data.password === sha1(passwords.admin)) ? 2 : 0;
            socket.emit('tmuxLoginReceived', { match });
        });

        socket.on('disconnect', () => {
            sockets.vue = sockets.vue.filter(s => { return s.id !== socket.id });
        })
    });

    io.sockets.on('connection', function(socket) {
        //console.log("NORMAL CONNECTION MADE on 8061");
    })
}

function getServers() {
    return Object.values(servers).map(server => {
        return { id: server.id, name: server.name }
    })
}

function getSessions(server) {
    if (hasServer(server))
    {
        return servers[server].getSessions();
    } else {
        return {};
    }
}

function getWindows(server, session) {
    if (!servers[server]) return [];
    return servers[server].sessions[session].getWindows().sort((a, b) => {
        return (a.index > b.index) ? 1 : -1;
    });
}

function getPanes(server, session, window) {
    if (Array.isArray(server)) {
        window = server.pop();
        session = server.pop();
        server = server.pop();
    }
    if (!servers[server] || !servers[server].sessions[session] || !servers[server].sessions[session].windows[window] ) return [];
    return servers[server].sessions[session].windows[window].getPanes();
}

module.exports = {
    init,
    getServers,
    getSessions,
    getWindows,
    getPanes,
    getPaneData(d) {
        if (!servers[d.server]) return [];
        try {
            return servers[d.server].sessions["$" + d.session].windows["@" + d.window].panes["%" + d.pane].getData();
        } catch(err) {
            return false;
        }
    },
    getPaneDataFromWindow(d) {
        if (!servers[d.server]) return [];
        return Object.entries(servers[d.server].sessions[`$${d.session}`].windows[`@${d.window}`].panes).map(pane => {
            return { id: pane[0], data: pane[1].getData()}
        });
    }
}