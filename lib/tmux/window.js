const Pane = require('./pane');

class Window {
    constructor(id, data) {
        this.id = id;
        this.name = data.name || '';
        this.layout = data.layout || '';
        this.index = data.index || false;
        this.panes = {};
    }

    addPane(id, data)
    {
        if (!this.hasPane(id))
            this.panes[id] = new Pane(id, data);
    }

    removePane(id)
    {
        if (this.hasPane(id))
        {
            this.panes[id].destroy;
            delete this.panes[id];
        }
    }

    hasPane(id) {
        return Object.keys(this.panes).includes(id);
    } 
    
    async destroy(components = []) {
        if (!components.length) {
            Object.keys(this.panes).forEach(key => {
                delete this.panes[key];
            });
            return Promise.resolve(true);
        }
        delete this.panes[components[0]];
        return Promise.resolve(false);
    }

    getPanes()
    {
        return this.layout;
    }
}

module.exports = Window;