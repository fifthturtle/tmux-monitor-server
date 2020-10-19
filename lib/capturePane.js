const PImage = require('pureimage');
const PText = require('pureimage/src/text');
const fs = require('fs-extra');
const mail = require('./mailData');

let colors = { "black": [0,0,0], "white": [255,255,255], "red": [255, 0, 0], "green": [0,255,0], "blue": [0,0,255], "yellow": [255,255,0], "cyan": [0,255,255], "magenta" : [255,0,255]};

function getColor(color, rgb = false, opacity = 1)
{
    let c = colors[color];
    if (!c) c = [128,128,128];
    if (rgb)
    {
        if (arguments.length > 2) c.push(opacity);
        c = c.join(',');
    } else {
        c = c.map(num => { let n = num.toString(16); while (n.length < 2) n = `0${n}`; return n; });
        c.unshift("#");
        c = c.join('');
    }
    return c;
}

function getImgWidth(lines, font)
{
    let longest = 0;
    let img = PImage.make(800, 800);
    let ctx = img.getContext('2d');
    ctx.font = "18pt, 'Consolas'";
    lines.forEach(line => {
        if (typeof line !== 'object') return;
        let text ='';
        if (line.userHost) {
            text = `${line.wrap.start}${line.userHost} ${line.currentDirectory}${line.wrap.end}$${line.lines[0]}`;
        } else {
            //text = line.filter(c => { if (c.chars && c.chars.length) return c.chars; }).join("");
            line.forEach(c => {
                if (c.chars && c.chars.length) text += c.chars;
            });
        }
        let w = Math.round(PText.measureText(ctx, text).width) + 32;
        longest = Math.max(longest, w);
    })
    return longest;
}

function createImage(data)
{
    let font = PImage.registerFont(`${__dirname}/fonts/CONSOLA.TTF`, 'Consolas');
    let imagePath = `${__dirname}/${(new Date).getTime()}.png`;
    
    font.load(() => {
        let img = PImage.make(getImgWidth(data.selection, font), 20 + (data.selection.length * 20));
    
        let ctx = img.getContext('2d');
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0,0,img.width, img.height);
        ctx.fillStyle = getColor('white');
        ctx.font = "18pt, 'Consolas'";
        data.selection.forEach((line, index) => {
            let lineNum = (index + 1) * 20;
            if (line.userHost) {
                let u = `${line.wrap.start}${line.userHost} ${line.currentDirectory}${line.wrap.end}$`;
                ctx.fillStyle = getColor('cyan');
                ctx.fillText(u, 10, lineNum);
                
                ctx.fillStyle = getColor('white');
                ctx.fillText(line.lines.join(' '), PText.measureText(ctx, u).width + 12, lineNum);
            } else {
                if (!Array.isArray(line)) line = [{ chars: line }];
                let start = 0;
                line.forEach(l => {
                    if (l.style) {
                        if (l.style['background-color'])
                        {
                            ctx.fillStyle = getColor(l.style['background-color']);
                            ctx.fillRect(start + 8, (index * 20) + 4, PText.measureText(ctx,l.chars).width + 2, 20);
                        }
                        ctx.fillStyle = getColor(l.style.color);
                    } else {
                        ctx.fillStyle = getColor('white');
                    }
                    ctx.fillText(l.chars, start + 10, lineNum);
                    start += PText.measureText(ctx, l.chars).width + 2;
                });
            }
        });
        
        PImage.encodePNGToStream(img, fs.createWriteStream(imagePath)).then(async () => {
            mail.send(data, imagePath);
        }).catch((e)=>{
            console.log("there was an error writing");
        });
    });
}

module.exports = {
    createImage
}