const Window = require('./window');

class Session {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.windows = {};
    }

    addWindow(id, data = {})
    {
        if (!this.hasWindow(id))
            this.windows[id] = new Window(id, data);
    }

    addPane(data)
    {
        let windowId = data.components.shift();
        this.addWindow(windowId);
        this.windows[windowId].addPane(data.components.shift(), data);
    }

    removeWindow(id)
    {
        if (this.hasWindow(id))
        {
            this.windows[id].destroy()
            delete this.windows[id];
        }
    }

    hasWindow(id) {
        return Object.keys(this.windows).includes(id);
    } 
    
    async destroy(components = []) {
        if (!components.length) {
            // destroying the session, and all of its windows
            return Promise.all(Object.values(this.windows).map(window => {
                return window.destroy();
            })).then(vals => {
                return Promise.resolve(true);
            });
        }
        let windowID = components.shift();
        let key = Object.keys(this.windows).find(window => {
            return window === windowID;
        });
        
        return await this.windows[key].destroy(components).then(res => {
            if (res) delete this.windows[key];
            return Promise.resolve(false);
        });
    }

    getWindows()
    {
        return Object.values(this.windows).map(window => {
            return { id: window.id, name: window.name, layout: window.layout, index: window.index };
        });
    }
}

module.exports = Session;