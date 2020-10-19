// module uses nodemailer component to send a screen capture of a particular tmux pane to Boolean reps for debugging

"use strict"

const nodemailer = require('nodemailer');
const fs = require('fs-extra');
const Datauri = require('datauri').promise;

function send(data, imagePath)
{
    let config = JSON.parse(fs.readFileSync(`${__dirname}/tmux/config.json`).toString());
    Datauri(imagePath).then(path => {
        let d = new Date;
        let html = `<h3>TMUX ISSUE</h3>
                        <div>Time: ${d}</div>`;
        if (data.message) html += `<blockquote><i>${data.message}</i></div>`; 
        fs.removeSync(imagePath);
        let transporter = nodemailer.createTransport(config.transport);
        let to = config.to.join(", ");
        let mailOptions = {
          from: '"TMUX Issue Alert" <test@cactusfantasy.com>',
          to,
          subject: data.subject || "TMUX Pane Issues",
          html,
          attachments: [
            {
              filename: "tmux-issue.png",
              path
            },
            {
                filename: 'lines.json',
                content: JSON.stringify(data.selection, null, 2),
                contentType: 'text/json'
            }
          ]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log("mail error", error);
            }
            console.log(`Message ${info.messageId} sent!`);
        });
    }).catch(err => {
        console.log('error creating data uri', err);
    })
}

module.exports = {
    send
}