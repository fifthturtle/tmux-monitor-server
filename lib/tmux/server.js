// Server class.
// Each instance of the server class represents one TMUX logging server.
// While the class structure wasn't used on the logger, it is used here as the Node Server may have to manage multiple TMUX servers
// The Server object manages its direct children -- the sessions.
// When a new Server is created, it has one session, which has one window, which has one pane. Thus, this will create one of each by default

"use strict"

const Session = require("./session");

class Server {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.sessions = {};
    }

    add_session(data)
    {
        if (Array.isArray(data.id)) data.id = data.id.shift();
        if (!this.hasSession(data.id))
            this.sessions[data.id] = new Session(data.id, data.name);
    }

    add_window(data)
    {
        let sessionId = data.components.shift();
        this.add_session({ id: sessionId, name: 'default' });
        this.sessions[sessionId].addWindow(data.components.shift(), data);
    }

    add_pane(data)
    {
        let sessionId = data.components.shift();
        this.add_session({ id: sessionId, name: 'default' });
        this.sessions[sessionId].addPane(data);
    }
    
    add(type, data)
    {
        this[`add_${type}`](data);
    }

    removeSession(id)
    {
        if (this.hasSession(id))
        {
            this.sessions[id].destroy()
            delete this.sessions[id];
        }
    }

    hasSession(id) {
        return Object.keys(this.sessions).includes(id);
    }

    async destroy(components) {
        if (!components.length) {
            // destroying the server, and all of its sessions
            return Promise.all(Object.values(this.sessions).map(session => {
                return session.destroy();
            })).then(vals => {
                return Promise.resolve(true);
            });
        }
        let sessionID = components.shift();
        
        return await this.sessions[sessionID].destroy(components).then(res => {
            if (res) delete this.sessions[sessionID];
            return Promise.resolve(false);
        });
    }

    getSessions()
    {
        return Object.values(this.sessions).map(session => {
            return { id: session.id, name: session.name }
        });
    }

}

module.exports = Server;