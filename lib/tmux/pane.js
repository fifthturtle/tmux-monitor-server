// Pane class.
// Each instance of the pane class represents one pane in the tmux instance.
// Pane is by far the most complicated object as it has to maintain all of the data
// Also manages pane's "mode" -- regular or top

"use strict"

class Pane {
    constructor(id, data) {
        this.id = id;
        this.name = data.name;
        this.process = data.process;
        this.lines = [];
        this.top = [];
        this.count = 0;
    }

    destroy() {
        this.lines = [];
    }

    getData() {
        return { name: this.id, lines: this.lines, top: this.top };
    }

    addLines(lines) {
        this.top = [];
        
        let fix = true;
        /*
        while (lines.length && !lines[lines.length - 1].userHost && fix) {
            let l = lines[lines.length - 1];
            let last = l.lines[l.lines.length - 1];
            while (l.lines.length && (typeof last === 'string' && !last.trim().length)) {
                l.lines.pop();
                if (l.lines.length) last = l.lines[l.lines.length - 1];
            }
            fix = (!l.lines.length)
            if (fix) lines.pop();
        }
        // */

        let last = lines[lines.length - 1];
        while (lines.length && !last.userHost && (typeof last === 'string') && !last.trim().length) {
            lines.pop();
            if (lines.length) last = lines[lines.length - 1];
        }

        if (!lines.length) return;
        if (this.lines.length) {
            let last = this.lines[this.lines.length - 1];
            let first = lines[0];
            if (last.userHost) {
                if (first.userHost && !last.lines.filter(l => { return !!l; }).length) this.lines.pop();
            } 
            //else {
            //    while (lines.length && !lines[0].input) lines.shift().lines.forEach(line => { last.lines.push(line); });
            //}
        }
        // */
        lines.forEach(line => { this.lines.push(line); });
        
        //let n = (this.lines.reduce((accumulator, currentValue, currentIndex, array) => { if (!accumulator) accumulator = 0; return parseInt(accumulator) + currentValue.lines.length }) - 2000);
        
        //for (let i = 0; i < n; i++)
        //{
        //  if (!this.lines.length) this.lines.shift();
        //  this.lines[0].lines.shift();
        //}

        while(this.lines.length > 2000) this.lines.shift();
    }
}

module.exports = Pane;